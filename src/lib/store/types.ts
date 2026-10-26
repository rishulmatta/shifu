// What Shifu keeps on the server (PLAN.md §8): one document per course, plus caches that make a
// rebuild of the same topic cheap. Learner progress is not here; it lives in the browser.

import type { PlanInput } from "../pipeline/plan";
import type { VideoHit } from "../sources/youtube";
import type { CaptionLine, Course } from "../types";

export type BuildStep = "queued" | "planning" | "finding" | "captions" | "clips" | "questions" | "ready" | "failed";

export interface BuildProgress {
  step: BuildStep;
  message: string;
  modulesReady: number;
  modulesTotal: number;
  costUsd: number;
  warnings: string[];
}

export interface CourseRecord {
  slug: string;
  input: PlanInput;
  /** Null until the plan exists; then filled in module by module. */
  course: Course | null;
  progress: BuildProgress;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  createCourse(record: CourseRecord): Promise<void>;
  getCourse(slug: string): Promise<CourseRecord | null>;
  updateCourse(slug: string, patch: Partial<Pick<CourseRecord, "course" | "progress">>): Promise<void>;
  listCourses(limit: number): Promise<CourseRecord[]>;

  /** undefined: not cached yet. null: the video has no usable captions. */
  getCaptions(videoId: string, lang: string): Promise<CaptionLine[] | null | undefined>;
  putCaptions(videoId: string, lang: string, lines: CaptionLine[] | null): Promise<void>;
  getSearch(query: string): Promise<VideoHit[] | undefined>;
  putSearch(query: string, hits: VideoHit[]): Promise<void>;
  getEmbeddable(videoId: string): Promise<boolean | undefined>;
  putEmbeddable(videoId: string, embeddable: boolean): Promise<void>;
}
