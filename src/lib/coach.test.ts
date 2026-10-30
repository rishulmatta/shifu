import { describe, expect, it } from "vitest";
import { type CoachContext, coachPrompt, resolve } from "./coach";
import { bayesCourse } from "./fixtures/bayes";

const ctx: CoachContext = {
  plan: bayesCourse.plan,
  states: { "bayes-rule/1": "solid", "bayes-rule/2": "shaky" },
  conceptId: "bayes-rule",
  misconceptions: [{ objectiveId: "bayes-rule/2", text: "That flips the condition." }],
  history: [],
  canGrow: true,
  playable: new Set(bayesCourse.plan.concepts.map((c) => c.id).filter((id) => id !== "updating-gradually")),
};

const out = (patch: Partial<Parameters<typeof resolve>[0]>) => ({
  reply: "ok",
  action: "none" as const,
  objectiveIds: [],
  conceptId: "",
  count: 0,
  title: "",
  why: "",
  objectives: [],
  searchQueries: [],
  ...patch,
});

describe("resolve", () => {
  it("keeps practice to real objectives, falling back to the weakest here, with 2 to 5 questions", () => {
    expect(resolve(out({ action: "practice", objectiveIds: ["bayes-rule/1", "made-up/9"], count: 9 }), ctx, "ab")).toEqual({
      kind: "practice",
      objectiveIds: ["bayes-rule/1"],
      count: 5,
    });
    expect(resolve(out({ action: "practice", objectiveIds: ["made-up/9"], count: 0 }), ctx, "ab")).toEqual({
      kind: "practice",
      objectiveIds: ["bayes-rule/2", "bayes-rule/1"],
      count: 3,
    });
  });

  it("builds a prerequisite of the current concept, in its module, with fresh ids", () => {
    const a = resolve(
      out({
        action: "prerequisite",
        title: "Conditional probability",
        why: "Bayes' rule flips one.",
        objectives: [{ text: "Read P(A|B) aloud", mustInclude: ["the bar means given"] }, { text: " " }].map((o) => ({ mustInclude: [], ...o })),
        searchQueries: ["conditional probability explained", ""],
      }),
      ctx,
      "x7",
    );
    expect(a).toMatchObject({ kind: "prerequisite", before: "bayes-rule" });
    if (a.kind !== "prerequisite") throw new Error();
    expect(a.concept.id).toBe("conditional-probability-x7");
    expect(a.concept.moduleIndex).toBe(bayesCourse.plan.concepts.find((c) => c.id === "bayes-rule")!.moduleIndex);
    expect(a.concept.objectives.map((o) => o.id)).toEqual(["conditional-probability-x7/1"]);
    expect(a.concept.searchQueries).toEqual(["conditional probability explained"]);
  });

  it("builds a concept the learner asked for after the current one", () => {
    const a = resolve(
      out({
        action: "extend",
        title: "Likelihood ratios",
        why: "They say how much one piece of evidence should move you.",
        objectives: [{ text: "Turn a likelihood ratio into an update", mustInclude: ["multiply the odds"] }],
        searchQueries: ["likelihood ratio explained"],
      }),
      ctx,
      "y2",
    );
    expect(a).toMatchObject({ kind: "extend", after: "bayes-rule" });
    if (a.kind !== "extend") throw new Error();
    expect(a.concept.id).toBe("likelihood-ratios-y2");
    expect(a.concept.moduleIndex).toBe(0);
    expect(resolve(out({ action: "extend", title: "Odds", objectives: [{ text: "Convert odds", mustInclude: [] }], searchQueries: ["odds"] }), { ...ctx, canGrow: false }, "ab")).toEqual({
      kind: "none",
    });
  });

  it("makes no change when a prerequisite can't be built or a concept doesn't exist", () => {
    const pre = out({ action: "prerequisite", title: "Odds", objectives: [{ text: "Convert odds", mustInclude: [] }], searchQueries: ["odds explained"] });
    expect(resolve(pre, { ...ctx, canGrow: false }, "ab")).toEqual({ kind: "none" });
    expect(resolve(pre, { ...ctx, conceptId: undefined }, "ab")).toEqual({ kind: "none" });
    expect(resolve(out({ action: "goto", conceptId: "nowhere" }), ctx, "ab")).toEqual({ kind: "none" });
    expect(resolve(out({ action: "goto", conceptId: "base-rates" }), ctx, "ab")).toEqual({ kind: "goto", conceptId: "base-rates" });
    expect(resolve(out({ action: "goto", conceptId: "updating-gradually" }), ctx, "ab")).toEqual({ kind: "none" });
  });
});

describe("coachPrompt", () => {
  it("shows the course with states, where the learner is and their mistakes", () => {
    const p = coachPrompt({ ...ctx, canGrow: false }, "explain the basics");
    expect(p).toContain("bayes-rule/2 (shaky)");
    expect(p).toContain("← the learner is here");
    expect(p).toContain("That flips the condition.");
    expect(p).toContain(`"prerequisite" and "extend" aren't available`);
    expect(p).toContain("updating-gradually · Updating gradually  (no clip: can't go there)");
    expect(p.trim().endsWith("The learner's message: explain the basics")).toBe(true);
  });
});

describe("coachPrompt for the basics control", () => {
  it("points the coach at the objective the learner is stuck on", () => {
    expect(coachPrompt(ctx, "I'm missing the basics", "bayes-rule/2")).toContain(`pressed "I'm missing the basics" on bayes-rule/2`);
    expect(coachPrompt(ctx, "hello")).not.toContain("pressed");
  });
});
