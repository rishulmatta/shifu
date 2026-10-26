import { getCourseRecord } from "@/lib/courses";

/** Build progress for the course page to poll while a course is being built. */
export async function GET(_: Request, ctx: RouteContext<"/api/courses/[slug]/progress">) {
  const record = await getCourseRecord((await ctx.params).slug);
  if (!record) return Response.json({ error: "not found" }, { status: 404 });
  const { step, message, modulesReady, modulesTotal } = record.progress;
  return Response.json({ step, message, modulesReady, modulesTotal }, { headers: { "Cache-Control": "no-store" } });
}
