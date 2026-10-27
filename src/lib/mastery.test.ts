import { describe, expect, it } from "vitest";
import { conceptState, initialProgress, nextState, tally } from "./mastery";
import type { MasteryEvent, ObjectiveProgress } from "./types";

const run = (...events: MasteryEvent[]): ObjectiveProgress =>
  events.reduce(nextState, initialProgress("bayes-rule/1"));

const right = { kind: "check", correct: true, unaided: true } as const;
const rightAided = { kind: "check", correct: true, unaided: false } as const;
const wrong = { kind: "check", correct: false, unaided: true } as const;
const covered = { kind: "teachback", verdict: "covered" } as const;
const missing = { kind: "teachback", verdict: "missing" } as const;
const good = { kind: "review", rating: "good" } as const;
const again = { kind: "review", rating: "again" } as const;

describe("nextState", () => {
  it("starts new", () => {
    expect(run().state).toBe("new");
  });

  it("is learning after any attempt, right or wrong", () => {
    expect(run(right).state).toBe("learning");
    expect(run(wrong).state).toBe("learning");
  });

  it("needs a right answer and a confirmation to be solid, in either order", () => {
    expect(run(right, covered).state).toBe("solid");
    expect(run(covered, right).state).toBe("solid");
    expect(run(right, good).state).toBe("solid");
  });

  it("does not count a right answer straight after a re-explanation towards solid", () => {
    expect(run(wrong, rightAided, covered).state).toBe("learning");
  });

  it("turns shaky after two misses in a row, not one", () => {
    expect(run(wrong).state).toBe("learning");
    expect(run(wrong, wrong).state).toBe("shaky");
    expect(run(wrong, right, wrong).state).toBe("learning");
  });

  it("turns shaky when a teach-back misses the point or a review is forgotten", () => {
    expect(run(right, covered, missing).state).toBe("shaky");
    expect(run(right, covered, again).state).toBe("shaky");
  });

  it("turns shaky at once on a confident miss", () => {
    expect(run({ ...wrong, confidence: "sure" }).state).toBe("shaky");
    expect(run({ ...wrong, confidence: "think" }).state).toBe("learning");
    expect(run(right, covered, { ...wrong, confidence: "sure" }).state).toBe("shaky");
  });

  it("does not count a lucky guess towards solid", () => {
    expect(run({ ...right, confidence: "guess" }, covered).state).toBe("learning");
    expect(run({ ...right, confidence: "think" }, covered).state).toBe("solid");
  });

  it("drops a solid objective to learning on a single miss", () => {
    expect(run(right, covered, wrong).state).toBe("learning");
  });

  it("lifts shaky to learning, never straight to solid, and starts the evidence again", () => {
    const shaky = run(wrong, wrong);
    expect(nextState(shaky, good).state).toBe("learning");
    expect(run(wrong, wrong, right).state).toBe("learning");
    expect(run(wrong, wrong, right, covered).state).toBe("solid");
    expect(run(right, covered, again, covered).state).toBe("learning");
  });

  it("stays shaky on more bad evidence", () => {
    expect(run(wrong, wrong, wrong).state).toBe("shaky");
  });
});

describe("conceptState", () => {
  it("is new only when nothing has been touched", () => {
    expect(conceptState(["new", "new"])).toBe("new");
    expect(conceptState(["new", "learning"])).toBe("learning");
  });

  it("is shaky if any objective is, and solid only if all are", () => {
    expect(conceptState(["solid", "shaky"])).toBe("shaky");
    expect(conceptState(["solid", "solid"])).toBe("solid");
    expect(conceptState(["solid", "new"])).toBe("learning");
  });
});

describe("tally", () => {
  it("counts each state", () => {
    expect(tally(["new", "solid", "solid", "shaky"])).toEqual({ new: 1, learning: 0, shaky: 1, solid: 2 });
  });
});
