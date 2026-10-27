import { getCourseRecord } from "@/lib/courses";
import { allowTeachback, visitor } from "@/lib/limits";
import { canTranscribe, transcribeWav } from "@/lib/models/transcribe";
import { textInSeconds } from "@/lib/pipeline/captions";
import { gradeTeachback } from "@/lib/pipeline/grade";
import { getStore } from "@/lib/store";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Grades a teach-back for one module: multipart with `moduleIndex` and either `audio` (WAV) or `text`. */
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
  if (explanation.split(/\s+/).length < 8) return fail("That's a bit short to grade. Say or type a few sentences.", 400);

  const store = getStore();
  const clipTexts = (
    await Promise.all(
      objectives.map(async (o) => {
        const span = chosen.get(o.id)!;
        const lines = await store.getCaptions(span.videoId, "en").catch(() => undefined);
        return lines ? textInSeconds(lines, span.start, span.end) : "";
      }),
    )
  ).filter(Boolean);

  try {
    const grade = await gradeTeachback({ objectives, clipTexts, explanation });
    return Response.json({ transcript: explanation, results: grade.results, encouragement: grade.encouragement });
  } catch (e) {
    console.error("teach-back grading failed:", e instanceof Error ? e.message : e);
    return fail("Grading failed. Try again in a moment.", 502);
  }
}
