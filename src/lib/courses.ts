// Course lookup. Until the database lands (PLAN.md §8) the only course is the hand-written sample.

import { bayesCourse } from "./fixtures/bayes";
import type { Course } from "./types";

const courses = new Map<string, Course>([[bayesCourse.slug, bayesCourse]]);

export async function getCourse(slug: string): Promise<Course | null> {
  return courses.get(slug) ?? null;
}

export async function listCourses(): Promise<Course[]> {
  return [...courses.values()];
}
