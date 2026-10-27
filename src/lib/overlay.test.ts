import { describe, expect, it } from "vitest";
import { bayesCourse } from "./fixtures/bayes";
import { applyPatch, dropConcept, mergeCourse, NO_OVERLAY } from "./overlay";
import type { Block, Concept } from "./types";

const prereq: Concept = {
  id: "conditional-x1",
  moduleIndex: 0,
  title: "Conditional probability",
  why: "Bayes' rule flips one.",
  prerequisites: [],
  objectives: [{ id: "conditional-x1/1", conceptId: "conditional-x1", text: "Read P(A|B) aloud", mustInclude: [] }],
  searchQueries: [],
};
const practice: Block = { kind: "practice", conceptId: "bayes-rule", itemIds: ["item-1"] };

describe("mergeCourse", () => {
  it("is the course itself, keyed by position, with nothing added", () => {
    const m = mergeCourse(bayesCourse, NO_OVERLAY);
    expect(m.course.timeline).toEqual(bayesCourse.timeline);
    expect(m.keys.slice(0, 3)).toEqual(["b0", "b1", "b2"]);
  });

  it("puts added blocks straight after their anchor, the newest first, and keeps the course's keys", () => {
    let o = applyPatch(NO_OVERLAY, { blocks: [practice] }, "b2");
    o = applyPatch(o, { blocks: [practice, practice] }, "b2");
    const m = mergeCourse(bayesCourse, o);
    expect(m.keys.slice(0, 7)).toEqual(["b0", "b1", "b2", "x1:0", "x1:1", "x0:0", "b3"]);
    expect(m.course.timeline[3]).toEqual(practice);
    expect(m.course.timeline.length).toBe(bayesCourse.timeline.length + 3);
  });

  it("places blocks anchored at ^ first, and blocks whose anchor is gone at the end", () => {
    const o = applyPatch(applyPatch(NO_OVERLAY, { blocks: [practice] }, "^"), { blocks: [practice] }, "b999");
    const m = mergeCourse(bayesCourse, o);
    expect(m.keys[0]).toBe("x0:0");
    expect(m.keys.at(-1)).toBe("x1:0");
  });

  it("adds a prerequisite concept to its module just before the concept that builds on it", () => {
    const o = applyPatch(NO_OVERLAY, { concept: prereq, before: "bayes-rule" }, "b0");
    const { plan } = mergeCourse(bayesCourse, o).course;
    const mod = plan.modules.find((x) => x.index === 0)!;
    expect(mod.conceptIds.indexOf("conditional-x1")).toBe(mod.conceptIds.indexOf("bayes-rule") - 1);
    expect(plan.concepts.find((c) => c.id === "bayes-rule")!.prerequisites).toContain("conditional-x1");
    expect(plan.concepts.some((c) => c.id === "conditional-x1")).toBe(true);
  });

  it("doesn't add a concept or its link twice, and can take a concept back", () => {
    let o = applyPatch(NO_OVERLAY, { concept: prereq, before: "bayes-rule" }, "b0");
    o = applyPatch(o, { concept: prereq, before: "bayes-rule", blocks: [practice] }, "b0");
    expect(o.concepts).toHaveLength(1);
    expect(o.links).toHaveLength(1);
    const back = dropConcept(o, prereq.id);
    expect(back.concepts).toHaveLength(0);
    expect(back.links).toHaveLength(0);
  });
});

describe("migrate", async () => {
  const { migrate } = await import("./learner");
  it("turns positions saved before keys into the course's own block keys", () => {
    const s = migrate({ answered: [2, 5] as unknown as string[], quizScores: { 9: { correct: 1, total: 2 } } });
    expect(s.answered).toEqual(["b2", "b5"]);
    expect(s.quizScores).toEqual({ b9: { correct: 1, total: 2 } });
    expect(s.overlay.insertions).toEqual([]);
  });
});
