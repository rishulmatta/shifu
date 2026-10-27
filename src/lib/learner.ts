// A learner's progress through one course, kept in this browser (there are no accounts; PLAN.md §4).
// Read it with useLearner(slug); every change goes through update(), which persists and notifies.

"use client";

import { useSyncExternalStore } from "react";
import { initialProgress, nextState } from "./mastery";
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

export interface LearnerState {
  /** Index of the current block in the course timeline. */
  position: number;
  objectives: Record<ObjectiveId, ObjectiveProgress>;
  /** Check and quiz blocks already answered, so going back doesn't record evidence twice. */
  answered: number[];
  /** Spans watched to their end. */
  watched: string[];
  /** The learner's own rating of each flashcard, for the review scheduler. */
  cards: Record<string, Rating>;
  quizScores: Record<number, { correct: number; total: number }>;
  attempts: Attempt[];
}

export const EMPTY: LearnerState = { position: 0, objectives: {}, answered: [], watched: [], cards: {}, quizScores: {}, attempts: [] };

const key = (slug: string) => `shifu:course:${slug}`;
const memory = new Map<string, LearnerState>();
const listeners = new Set<() => void>();

function load(slug: string): LearnerState {
  const hit = memory.get(slug);
  if (hit) return hit;
  let state = EMPTY;
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
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
