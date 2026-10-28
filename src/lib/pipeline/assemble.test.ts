import { describe, expect, it } from "vitest";
import { bayesCourse } from "../fixtures/bayes";
import { assembleTimeline } from "./assemble";

const kinds = bayesCourse.timeline.map((b) => b.kind);

describe("assembleTimeline", () => {
  it("opens each concept with an intro, then a clip and a check per objective", () => {
    expect(kinds.slice(1, 7)).toEqual(["intro", "clip", "check", "clip", "check", "cards"]);
  });

  it("puts the goal challenge first and, once the course is built, last", () => {
    expect(bayesCourse.timeline[0]).toEqual({ kind: "challenge", stage: "before" });
    expect(bayesCourse.timeline.at(-1)).toEqual({ kind: "challenge", stage: "after" });
    const { plan, spans, items } = bayesCourse;
    expect(assembleTimeline(plan, spans, items).some((b) => b.kind === "challenge")).toBe(false);
    expect(assembleTimeline(plan, [], items, { before: true, after: true })).toEqual([{ kind: "challenge", stage: "before" }]);
  });

  it("ends every module with a teach-back and a quiz", () => {
    const ends = bayesCourse.timeline.filter((b) => b.kind === "teachback" || b.kind === "quiz");
    expect(ends.map((b) => `${b.kind}:${"moduleIndex" in b ? b.moduleIndex : ""}`)).toEqual([
      "teachback:0",
      "quiz:0",
      "teachback:1",
      "quiz:1",
    ]);
  });

  it("follows the plan's order, so prerequisites come first", () => {
    const intros = bayesCourse.timeline.flatMap((b) => (b.kind === "intro" ? [b.conceptId] : []));
    expect(intros).toEqual(["priors-and-evidence", "bayes-rule", "base-rates", "updating-gradually"]);
  });

  it("mixes earlier modules into later quizzes, without repeating the lesson's check", () => {
    const quiz = bayesCourse.timeline.find((b) => b.kind === "quiz" && b.moduleIndex === 1);
    if (quiz?.kind !== "quiz") throw new Error("no quiz");
    const objectives = quiz.itemIds.map((id) => bayesCourse.items.find((i) => i.id === id)?.objectiveId);
    expect(objectives).toContain("bayes-rule/2");
    const lessonChecks = new Set(bayesCourse.timeline.flatMap((b) => (b.kind === "check" ? [b.itemId] : [])));
    expect(quiz.itemIds.some((id) => lessonChecks.has(id))).toBe(false);
  });

  it("leaves out a concept with nothing to watch, and a module with no concepts", () => {
    const spans = bayesCourse.spans.filter((s) => !s.objectiveId.startsWith("bayes-rule/") && !s.objectiveId.startsWith("updating-gradually/"));
    const blocks = assembleTimeline(bayesCourse.plan, spans, bayesCourse.items);
    const intros = blocks.flatMap((b) => (b.kind === "intro" ? [b.conceptId] : []));
    expect(intros).toEqual(["priors-and-evidence", "base-rates"]);
    expect(blocks.some((b) => b.kind === "cards" && b.conceptId === "bayes-rule")).toBe(false);

    const none = assembleTimeline(bayesCourse.plan, [], bayesCourse.items);
    expect(none).toEqual([]);
  });

  it("skips an objective that has no chosen span instead of failing", () => {
    const spans = bayesCourse.spans.filter((s) => s.objectiveId !== "bayes-rule/2");
    const blocks = assembleTimeline(bayesCourse.plan, spans, bayesCourse.items);
    expect(blocks.some((b) => b.kind === "clip" && b.objectiveId === "bayes-rule/2")).toBe(false);
    expect(blocks.some((b) => b.kind === "clip" && b.objectiveId === "bayes-rule/1")).toBe(true);
  });
});
