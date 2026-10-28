import { z } from "zod";
import { getCourseRecord } from "@/lib/courses";
import { allowRetry, visitor } from "@/lib/limits";
import { cached } from "@/lib/pipeline/build";
import { textInSeconds } from "@/lib/pipeline/captions";
import { writeRetry } from "@/lib/pipeline/retry";
import { liveSources } from "@/lib/sources";
import { canFetchCaptions } from "@/lib/sources/youtube";
import { getStore } from "@/lib/store";
import type { CheckItem } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({ itemId: z.string().min(1).max(200), choice: z.number().int().min(0).max(3) });
const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * "Explain it differently" aimed at a wrong pick (PLAN.md §3): which other creator's clip clears up
 * the misconception behind it, what to watch for, and a question aimed at it. Any error tells the
 * player to use the pre-built alternate instead.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/courses/[slug]/retry">) {
  const record = await getCourseRecord((await ctx.params).slug);
  const course = record?.course;
  if (!course) return fail("Course not found", 404);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Expected an item and a choice", 400);
  const { itemId, choice } = parsed.data;
  const item = course.items.find((i): i is CheckItem => i.kind === "mcq" && i.id === itemId);
  if (!item) return fail("No such question", 404);
  if (choice === item.answerIndex) return fail("That answer was right", 400);
  const objective = course.plan.concepts.flatMap((c) => c.objectives).find((o) => o.id === item.objectiveId);
  if (!objective) return fail("No such objective", 404);

  const store = getStore();
  const allowed = await allowRetry(store, visitor(req.headers));
  if (!allowed.ok) return fail(allowed.message, 429);

  const chosen = course.spans.find((s) => s.objectiveId === objective.id && s.rank === 0);
  const alternates = course.spans.filter((s) => s.objectiveId === objective.id && s.rank > 0 && s.videoId !== chosen?.videoId);
  const captions = canFetchCaptions() ? cached(liveSources, store).captions : async (id: string) => (await store.getCaptions(id, "en")) ?? null;
  const clips = (
    await Promise.all(
      alternates.map(async (span) => {
        const lines = await captions(span.videoId).catch(() => null);
        return lines ? { span, text: textInSeconds(lines, span.start, span.end) } : undefined;
      }),
    )
  ).filter((c): c is NonNullable<typeof c> => !!c?.text);
  if (!clips.length) return fail("No other creator's captions for this objective", 404);

  const picked = item.options[choice];
  const misconception = item.whyWrong?.[choice] || `They chose "${picked}" over "${item.options[item.answerIndex]}".`;
  try {
    const out = await writeRetry(objective, { prompt: item.prompt, picked, misconception }, clips, `retry-${Date.now().toString(36)}`);
    if (!out.retry) return fail(`The question didn't pass its checks (${out.dropped})`, 422);
    return Response.json(out.retry, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("retry failed:", e instanceof Error ? e.message : e);
    return fail("Couldn't write a targeted explanation", 502);
  }
}
