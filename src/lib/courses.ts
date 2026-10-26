// Course lookup: the hand-written sample, or a built course from the store.

import { bayesCourse } from "./fixtures/bayes";
import { getStore, type CourseRecord } from "./store";

const sample: CourseRecord = {
  slug: bayesCourse.slug,
  input: { topic: bayesCourse.plan.topic, goal: bayesCourse.plan.goal, level: bayesCourse.plan.level, minutesPerDay: bayesCourse.plan.minutesPerDay },
  course: bayesCourse,
  progress: { step: "ready", message: "Ready", modulesReady: 2, modulesTotal: 2, costUsd: 0, warnings: [] },
  createdAt: "2026-10-27T00:00:00.000Z",
  updatedAt: "2026-10-27T00:00:00.000Z",
};

export const SAMPLE_SLUG = sample.slug;

export async function getCourseRecord(slug: string): Promise<CourseRecord | null> {
  if (slug === sample.slug) return sample;
  return getStore().getCourse(slug);
}

/** Built courses, newest first, for the home page. */
export async function recentCourses(limit = 6): Promise<CourseRecord[]> {
  const records = await getStore().listCourses(limit * 2);
  return records.filter((r) => r.progress.step === "ready").slice(0, limit);
}
