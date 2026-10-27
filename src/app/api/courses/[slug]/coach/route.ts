import { z } from "zod";
import { type CoachAction, decide } from "@/lib/coach";
import { getCourseRecord } from "@/lib/courses";
import { allowCoach, allowGrow, visitor } from "@/lib/limits";
import { mergeCourse, NO_OVERLAY, type OverlayPatch } from "@/lib/overlay";
import { cached } from "@/lib/pipeline/build";
import { growConcept, writePracticeFor } from "@/lib/pipeline/grow";
import { liveSources, missingForBuilds } from "@/lib/sources";
import { canFetchCaptions } from "@/lib/sources/youtube";
import { getStore } from "@/lib/store";
import type { BuildStep } from "@/lib/store";
import type { CheckItem } from "@/lib/types";

// A prerequisite is a small build: finding videos, reading captions and writing questions.
export const maxDuration = 300;

const Id = z.string().min(1).max(80);
const Objective = z.object({ id: Id, conceptId: Id, text: z.string().max(240), mustInclude: z.array(z.string().max(160)).max(4) });
const Concept = z.object({
  id: Id,
  moduleIndex: z.number().int().min(0).max(40),
  title: z.string().max(80),
  why: z.string().max(240),
  prerequisites: z.array(Id).max(12),
  objectives: z.array(Objective).max(4),
  searchQueries: z.array(z.string().max(120)).max(4),
});
const Span = z.object({
  id: z.string().min(1).max(160),
  objectiveId: Id,
  videoId: z.string().regex(/^[\w-]{6,20}$/),
  start: z.number().min(0),
  end: z.number().min(0),
  rank: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  covers: z.array(z.string().max(200)).max(6),
  selfContained: z.boolean(),
});
const State = z.enum(["new", "learning", "shaky", "solid"]);

/** What the coach panel sends: the message, where the learner is, and what was added for them. */
const Body = z.object({
  message: z.string().trim().min(1).max(500),
  history: z.array(z.object({ from: z.enum(["learner", "coach"]), text: z.string().max(800) })).max(8),
  conceptId: Id.optional(),
  /**
   * Sent by the coach controls under a clip or question, which name their objective: "practice"
   * needs no model to decide, "basics" asks the model only for the missing foundation.
   */
  intent: z.object({ kind: z.enum(["practice", "basics"]), objectiveId: Id }).optional(),
  states: z.record(Id, State),
  misconceptions: z.array(z.object({ objectiveId: Id, text: z.string().max(300) })).max(5),
  added: z.object({
    concepts: z.array(Concept).max(12),
    links: z.array(z.object({ conceptId: Id, prerequisiteId: Id })).max(12),
    spans: z.array(Span).max(60),
    /** Prompts of questions the coach already added, per objective. */
    asked: z.record(Id, z.array(z.string().max(400)).max(30)),
  }),
});

/** One line of the streamed reply. */
export type CoachEvent =
  | { type: "reply"; text: string; action: CoachAction }
  | { type: "progress"; text: string; step?: BuildStep }
  | { type: "patch"; patch: OverlayPatch }
  | { type: "failed"; text: string };

const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * The course coach (PLAN.md §3): one message in, one change to the learner's course out. The reply
 * comes first; practice questions and new concepts follow as a patch for the learner's overlay.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/courses/[slug]/coach">) {
  const record = await getCourseRecord((await ctx.params).slug);
  const course = record?.course;
  if (!course) return fail("Course not found", 404);

  const store = getStore();
  const who = visitor(req.headers);
  const allowed = await allowCoach(store, who);
  if (!allowed.ok) return fail(allowed.message, 429);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("That message couldn't be read", 400);
  const body = parsed.data;

  const { course: mine } = mergeCourse(course, { ...NO_OVERLAY, concepts: body.added.concepts, links: body.added.links, spans: body.added.spans });
  const intent = body.intent;
  if (intent && !mine.plan.concepts.some((c) => c.objectives.some((o) => o.id === intent.objectiveId))) return fail("No such objective", 400);
  const coachCtx = {
    plan: mine.plan,
    states: body.states,
    conceptId: body.conceptId,
    // Added concepts arrive here only once they have their blocks.
    playable: new Set([...course.timeline.flatMap((b) => (b.kind === "intro" ? [b.conceptId] : [])), ...body.added.concepts.map((c) => c.id)]),
    misconceptions: body.misconceptions,
    history: body.history,
    canGrow: missingForBuilds().length === 0,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: CoachEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        const tag = Date.now().toString(36);
        const { reply, action } =
          intent?.kind === "practice"
            ? { reply: "Three more questions on this come next.", action: { kind: "practice", objectiveIds: [intent.objectiveId], count: 3 } as CoachAction }
            : await decide(coachCtx, body.message, tag.slice(-4), intent?.objectiveId);
        send({ type: "reply", text: reply, action });

        if (action.kind === "practice") {
          const objectives = action.objectiveIds.flatMap((id) => mine.plan.concepts.flatMap((c) => c.objectives.filter((o) => o.id === id)));
          send({ type: "progress", text: `Writing ${action.count} questions` });
          const asked = Object.fromEntries(
            objectives.map((o) => [
              o.id,
              [
                ...mine.items.filter((i): i is CheckItem => i.kind === "mcq" && i.objectiveId === o.id).map((i) => i.prompt),
                ...(body.added.asked[o.id] ?? []),
              ],
            ]),
          );
          const captions = canFetchCaptions()
            ? cached(liveSources, store).captions
            : async (videoId: string) => (await store.getCaptions(videoId, "en")) ?? null;
          const out = await writePracticeFor({ objectives, spans: mine.spans, asked, count: action.count, captions }, `p${tag}`);
          if (!out.items.length) send({ type: "failed", text: "I couldn't write questions that pass the checks this time." });
          else {
            const conceptId = objectives[0].conceptId;
            send({ type: "patch", patch: { items: out.items, blocks: [{ kind: "practice", conceptId, itemIds: out.items.map((i) => i.id) }] } });
          }
        } else if (action.kind === "prerequisite") {
          const grow = await allowGrow(store, who);
          if (!grow.ok) send({ type: "failed", text: grow.message });
          else {
            const sources = cached(liveSources, store);
            const out = await growConcept(mine.plan, action.concept, action.before, sources, (text, step) => send({ type: "progress", text, step }));
            send({ type: "patch", patch: out.patch });
          }
        }
      } catch (e) {
        console.error("coach failed:", e instanceof Error ? e.message : e);
        send({ type: "failed", text: e instanceof Error && e.message.startsWith("No clip") ? e.message : "Something went wrong on my side. Try again in a moment." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
