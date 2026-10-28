import { getCourseRecord } from "@/lib/courses";
import { allowTeachback, visitor } from "@/lib/limits";
import { canTranscribe, transcribeWav } from "@/lib/models/transcribe";
import { textInSeconds } from "@/lib/pipeline/captions";
import { gradeAnswer, gradeTeachback } from "@/lib/pipeline/grade";
import { getStore } from "@/lib/store";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * Grades a teach-back for one module: multipart with `moduleIndex` and either `audio` (WAV) or
 * `text`, plus `misconceptions` (JSON, the learner's recent ones in the module) as clues for the
 * student's question. With `mode=answer`, `objectiveId` and `question`, it grades the learner's
 * answer to that question instead, on that objective alone.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/courses/[slug]/teachback">) {
  const record = await getCourseRecord((await ctx.params).slug);
  const course = record?.course;
  if (!course) return fail("Course not found", 404);

  const allowed = await allowTeachback(getStore(), visitor(req.headers));
  if (!allowed.ok) return fail(allowed.message, 429);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Expected a form", 400);
  const moduleIndex = Number(form.get("moduleIndex"));
  const mod = course.plan.modules.find((m) => m.index === moduleIndex);
  if (!mod) return fail("No such module", 400);

  const chosen = new Map(course.spans.filter((s) => s.rank === 0).map((s) => [s.objectiveId, s]));
  const objectives = mod.conceptIds
    .flatMap((id) => course.plan.concepts.find((c) => c.id === id)?.objectives ?? [])
    .filter((o) => chosen.has(o.id));
  if (!objectives.length) return fail("This module has nothing to explain yet", 400);

  let explanation = String(form.get("text") ?? "").trim();
  const audio = form.get("audio");
  if (audio instanceof Blob && audio.size > 0) {
    if (!canTranscribe()) return fail("Voice isn't switched on yet. Type your explanation instead.", 503);
    if (audio.size > MAX_AUDIO_BYTES) return fail("That recording is too long. Keep it under 90 seconds.", 413);
    try {
      explanation = await transcribeWav(audio);
    } catch (e) {
      console.error("teach-back transcription failed:", e instanceof Error ? e.message : e);
      return fail("We couldn't transcribe that. Try again, or type it instead.", 502);
    }
  }
  const answering = form.get("mode") === "answer";
  if (explanation.split(/\s+/).length < (answering ? 3 : 8)) {
    return fail(answering ? "Say or type a sentence or two." : "That's a bit short to grade. Say or type a few sentences.", 400);
  }

  const store = getStore();
  const clipText = async (objectiveId: string) => {
    const span = chosen.get(objectiveId)!;
    const lines = await store.getCaptions(span.videoId, "en").catch(() => undefined);
    return lines ? textInSeconds(lines, span.start, span.end) : "";
  };

  if (answering) {
    const objective = objectives.find((o) => o.id === form.get("objectiveId"));
    const question = String(form.get("question") ?? "").trim().slice(0, 300);
    if (!objective || !question) return fail("No such question", 400);
    try {
      const graded = await gradeAnswer({ objective, question, answer: explanation, clipText: await clipText(objective.id) });
      const result = { objectiveId: graded.objectiveId, verdict: graded.verdict, note: graded.note, heard: graded.heard };
      return Response.json({ transcript: explanation, result });
    } catch (e) {
      console.error("teach-back answer grading failed:", e instanceof Error ? e.message : e);
      return fail("Grading failed. Try again in a moment.", 502);
    }
  }

  const misconceptions = parseMisconceptions(form.get("misconceptions"));
  const clipTexts = (await Promise.all(objectives.map((o) => clipText(o.id)))).filter(Boolean);

  try {
    const grade = await gradeTeachback({ objectives, clipTexts, explanation, misconceptions });
    return Response.json({ transcript: explanation, results: grade.results, encouragement: grade.encouragement, followUp: grade.followUp });
  } catch (e) {
    console.error("teach-back grading failed:", e instanceof Error ? e.message : e);
    return fail("Grading failed. Try again in a moment.", 502);
  }
}

/** At most five short strings from the form's JSON, or none. */
function parseMisconceptions(field: FormDataEntryValue | null): string[] {
  try {
    const list = JSON.parse(String(field ?? "[]"));
    return Array.isArray(list) ? list.filter((m): m is string => typeof m === "string").slice(0, 5).map((m) => m.slice(0, 200)) : [];
  } catch {
    return [];
  }
}
