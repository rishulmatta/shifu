import { describe, expect, it } from "vitest";
import { CourseView } from "./course-view";
import { bayesCourse } from "./fixtures/bayes";

describe("clipIndex", () => {
  const view = new CourseView(bayesCourse);
  const clips = bayesCourse.timeline.flatMap((b, i) => (b.kind === "clip" ? [i] : []));

  it("finds the next clip after any block, and -1 past the last", () => {
    expect(clips.length).toBeGreaterThan(1);
    expect(view.clipIndex(-1)).toBe(clips[0]);
    expect(view.clipIndex(clips[0])).toBe(clips[1]);
    expect(view.clipIndex(clips.at(-1)!)).toBe(-1);
  });

  it("finds the previous clip, and -1 before the first", () => {
    expect(view.clipIndex(clips[1], -1)).toBe(clips[0]);
    expect(view.clipIndex(clips[0], -1)).toBe(-1);
  });
});
