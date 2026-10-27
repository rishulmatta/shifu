// Mastery rules (PLAN.md §7). Pure functions: the player, the review queue and the mind map all
// read state through these, and the tests in mastery.test.ts pin the rules down.

import type { MasteryEvent, MasteryState, ObjectiveId, ObjectiveProgress } from "./types";

export function initialProgress(objectiveId: ObjectiveId): ObjectiveProgress {
  return { objectiveId, state: "new", correct: false, confirmed: false, missStreak: 0 };
}

/**
 * Applies one piece of evidence. The latest evidence wins:
 * - two misses in a row, a confident miss, a teach-back that misses the point, or a forgotten
 *   review → shaky (and the evidence for solid starts again);
 * - from shaky, any good evidence lifts to learning, never straight to solid;
 * - solid needs an unaided correct answer and a later confirmation (teach-back or spaced review);
 *   a right answer the learner called a guess is progress, not that correct answer.
 */
export function nextState(p: ObjectiveProgress, e: MasteryEvent): ObjectiveProgress {
  let { correct, confirmed, missStreak } = p;
  let lapse = false;
  let good = false;

  switch (e.kind) {
    case "check":
      if (e.correct) {
        missStreak = 0;
        good = true;
        if (e.unaided && e.confidence !== "guess") correct = true;
      } else {
        missStreak += 1;
        correct = false;
        // Sure and wrong is a misconception, not a gap: it goes to the front of the review at once.
        lapse = missStreak >= 2 || e.confidence === "sure";
      }
      break;
    case "teachback":
      if (e.verdict === "covered") {
        confirmed = true;
        good = true;
      } else {
        lapse = true;
      }
      break;
    case "review":
      if (e.rating === "again") {
        lapse = true;
      } else {
        correct = true;
        confirmed = true;
        missStreak = 0;
        good = true;
      }
      break;
  }

  if (lapse) return { ...p, state: "shaky", correct: false, confirmed: false, missStreak: 0 };
  const state: MasteryState =
    p.state === "shaky" ? (good ? "learning" : "shaky") : correct && confirmed ? "solid" : "learning";
  return { ...p, state, correct, confirmed, missStreak };
}

/** A concept is as strong as its weakest objective; untouched objectives don't drag it to "new". */
export function conceptState(states: MasteryState[]): MasteryState {
  if (states.every((s) => s === "new")) return "new";
  if (states.includes("shaky")) return "shaky";
  if (states.every((s) => s === "solid")) return "solid";
  return "learning";
}

/** Counts per state, for the progress tracker's mastery bar. */
export function tally(states: MasteryState[]): Record<MasteryState, number> {
  const out = { new: 0, learning: 0, shaky: 0, solid: 0 };
  for (const s of states) out[s] += 1;
  return out;
}
