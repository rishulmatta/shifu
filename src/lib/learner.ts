// A learner's progress through one course, kept in this browser (there are no accounts; PLAN.md §4).
// Read it with useLearner(slug); every change goes through update(), which persists and notifies.

"use client";

import { useSyncExternalStore } from "react";
import { initialProgress, nextState } from "./mastery";
import { NO_OVERLAY, type Overlay } from "./overlay";
import type { CheckItem, Confidence, MasteryEvent, ObjectiveId, ObjectiveProgress } from "./types";

export type Rating = "again" | "hard" | "good" | "easy";

/** One answered question, for calibration and for the teach-back student's follow-up. */
export interface Attempt {
  itemId: string;
  objectiveId: ObjectiveId;
  correct: boolean;
  confidence: Confidence;
  /** The misconception behind a wrong pick, when the question names one. */
  misconception?: string;
}

/** What a coach turn changed in the course, shown as a card under the reply. */
export interface CoachChange {
  kind: "practice" | "prerequisite" | "reexplain" | "goto" | "skip";
  status: "working" | "done" | "failed";
  note: string;
  /** Key of the first block it added, for "Start now". */
  goTo?: string;
  /** Practice: how many questions. */
  count?: number;
  /** Prerequisite: the new concept and the title of the one it comes before. */
  concept?: { id: string; title: string };
  before?: string;
  /** While a prerequisite builds: 0 to 3, finding videos to writing questions. */
  step?: number;
}

/** One message in the coach window. */
export interface CoachTurn {
  from: "learner" | "coach";
  text: string;
  change?: CoachChange;
}

export interface LearnerState {
  /** Index of the current block in the course timeline, with the learner's additions merged in. */
  position: number;
  objectives: Record<ObjectiveId, ObjectiveProgress>;
  /** Keys (overlay.ts) of check blocks already answered, so going back doesn't record evidence twice. */
  answered: string[];
  /** Spans watched to their end. */
  watched: string[];
  /** The learner's own rating of each flashcard, for the review scheduler. */
  cards: Record<string, Rating>;
  /** By block key, for quiz and practice blocks. */
  quizScores: Record<string, { correct: number; total: number }>;
  attempts: Attempt[];
  /** What the coach added for this learner, and the conversation. */
  overlay: Overlay;
  coach: CoachTurn[];
  /** Goal-challenge answers by challenge, before the course and after it; null is "I don't know yet". */
  challenge: { before?: (number | null)[]; after?: (number | null)[] };
}

export const EMPTY: LearnerState = {
  position: 0,
  objectives: {},
  answered: [],
  watched: [],
  cards: {},
  quizScores: {},
  attempts: [],
  overlay: NO_OVERLAY,
  coach: [],
  challenge: {},
};

/**
 * Progress saved before 28 Oct recorded answered blocks and quiz scores by position; with no
 * additions then, position n is the key "bn".
 */
export function migrate(saved: Partial<LearnerState> & { answered?: (string | number)[] }): LearnerState {
  const s = { ...EMPTY, ...saved };
  return {
    ...s,
    answered: (saved.answered ?? []).map((a) => (typeof a === "number" ? `b${a}` : a)),
    quizScores: Object.fromEntries(Object.entries(s.quizScores).map(([k, v]) => [/^\d+$/.test(k) ? `b${k}` : k, v])),
  };
}

const key = (slug: string) => `shifu:course:${slug}`;
const memory = new Map<string, LearnerState>();
const listeners = new Set<() => void>();

function load(slug: string): LearnerState {
  const hit = memory.get(slug);
  if (hit) return hit;
  let state = EMPTY;
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (raw) state = migrate(JSON.parse(raw));
  } catch {
    // Storage blocked or corrupt: start fresh and keep progress in memory for this visit.
  }
  memory.set(slug, state);
  return state;
}

export function update(slug: string, change: (s: LearnerState) => LearnerState) {
  const next = change(load(slug));
  memory.set(slug, next);
  try {
    window.localStorage.setItem(key(slug), JSON.stringify(next));
  } catch {
    // Not persisted; still correct for this visit.
  }
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (!e.key?.startsWith("shifu:course:")) return;
    memory.delete(e.key.slice("shifu:course:".length));
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The learner's state for a course; EMPTY on the server and during hydration. */
export function useLearner(slug: string): LearnerState {
  return useSyncExternalStore(
    subscribe,
    () => load(slug),
    () => EMPTY,
  );
}

/** Applies one piece of mastery evidence to an objective. */
export function withEvidence(s: LearnerState, objectiveId: ObjectiveId, event: MasteryEvent): LearnerState {
  const prev = s.objectives[objectiveId] ?? initialProgress(objectiveId);
  return { ...s, objectives: { ...s.objectives, [objectiveId]: nextState(prev, event) } };
}

/** Records an answer to a check or quiz question: the attempt, and the mastery evidence it gives. */
export function withAnswer(s: LearnerState, item: CheckItem, choice: number, confidence: Confidence, unaided: boolean): LearnerState {
  const correct = choice === item.answerIndex;
  const misconception = correct ? undefined : item.whyWrong?.[choice] || undefined;
  const attempt: Attempt = { itemId: item.id, objectiveId: item.objectiveId, correct, confidence, ...(misconception && { misconception }) };
  return withEvidence({ ...s, attempts: [...s.attempts, attempt] }, item.objectiveId, { kind: "check", correct, unaided, confidence });
}
