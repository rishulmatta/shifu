// The review scheduler (PLAN.md §7, "Review"): spaced repetition for flashcards and objective
// checks, wrapping ts-fsrs. Pure functions, no React. Claude Code will wire this into the learner
// state (src/lib/learner.ts) and build the review queue and Today panel on it.

import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import type { ObjectiveId } from "./types";

export type ReviewRating = "again" | "hard" | "good" | "easy";

/**
 * Whatever ts-fsrs needs, as plain JSON (dates as ISO strings) so it can live in the browser's
 * localStorage with the rest of the learner state. Mirrors the ts-fsrs `Card`; `state` is its
 * State enum (0 new, 1 learning, 2 review, 3 relearning).
 */
export interface FsrsState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export interface ReviewCard {
  id: string;
  kind: "card" | "check";
  objectiveId: ObjectiveId;
  fsrs: FsrsState;
}

// Default FSRS parameters, request retention 0.9.
const scheduler = fsrs({ request_retention: 0.9 });

const GRADES: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toCard(state: FsrsState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    learning_steps: state.learning_steps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  } as Card;
}

function fromCard(card: Card): FsrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    ...(card.last_review && { last_review: card.last_review.toISOString() }),
  };
}

export function newCard(id: string, kind: ReviewCard["kind"], objectiveId: ObjectiveId, now: Date): ReviewCard {
  return { id, kind, objectiveId, fsrs: fromCard(createEmptyCard(now)) };
}

export function rate(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard {
  const next = scheduler.next(toCard(card.fsrs), now, GRADES[rating]);
  return { ...card, fsrs: fromCard(next.card) };
}

/** Cards due at or before `now`, oldest due first. */
export function due(cards: ReviewCard[], now: Date): ReviewCard[] {
  return cards
    .filter((c) => new Date(c.fsrs.due).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime());
}

/** 15 s per card, 30 s per check, rounded up to whole minutes (for the Today panel). */
export function estimateMinutes(cards: ReviewCard[]): number {
  const seconds = cards.reduce((total, c) => total + (c.kind === "check" ? 30 : 15), 0);
  return Math.ceil(seconds / 60);
}
