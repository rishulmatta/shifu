// Read-only lookups over a course and a learner's progress, shared by the player and the outline.

import { conceptState, tally } from "./mastery";
import type { LearnerState } from "./learner";
import type { Concept, Course, MasteryState, ObjectiveId, RecallItem, Span } from "./types";

export class CourseView {
  readonly concepts: Map<string, Concept>;
  readonly spans: Map<string, Span>;
  readonly items: Map<string, RecallItem>;
  /** Concepts with something to play: still-building modules and clip-less concepts are left out. */
  readonly available: Set<string>;

  constructor(readonly course: Course) {
    this.concepts = new Map(course.plan.concepts.map((c) => [c.id, c]));
    this.spans = new Map(course.spans.map((s) => [s.id, s]));
    this.items = new Map(course.items.map((i) => [i.id, i]));
    this.available = new Set(course.timeline.flatMap((b) => (b.kind === "intro" ? [b.conceptId] : [])));
  }

  objective(id: ObjectiveId) {
    const concept = this.concepts.get(id.split("/")[0]);
    return concept?.objectives.find((o) => o.id === id);
  }

  /** The first alternate span for an objective, from a different video than the chosen one. */
  alternate(objectiveId: ObjectiveId): Span | undefined {
    const chosen = this.course.spans.find((s) => s.objectiveId === objectiveId && s.rank === 0);
    return this.course.spans.find((s) => s.objectiveId === objectiveId && s.rank > 0 && s.videoId !== chosen?.videoId);
  }

  /** Check questions for an objective, in the order the timeline uses them. */
  checks(objectiveId: ObjectiveId) {
    return this.course.items.filter((i) => i.kind === "mcq" && i.objectiveId === objectiveId);
  }

  /** Index of the concept's intro block, or -1. */
  introIndex(conceptId: string) {
    return this.course.timeline.findIndex((b) => b.kind === "intro" && b.conceptId === conceptId);
  }

  /** Index of the next clip after `from` (or the previous one before it), or -1. */
  clipIndex(from: number, direction: 1 | -1 = 1) {
    const { timeline } = this.course;
    for (let i = from + direction; i >= 0 && i < timeline.length; i += direction) {
      if (timeline[i].kind === "clip") return i;
    }
    return -1;
  }

  /** The concept the block at `index` belongs to (the last intro at or before it). */
  conceptAt(index: number): Concept | undefined {
    for (let i = Math.min(index, this.course.timeline.length - 1); i >= 0; i--) {
      const b = this.course.timeline[i];
      if (b.kind === "intro") return this.concepts.get(b.conceptId);
    }
    return undefined;
  }

  objectiveState(learner: LearnerState, id: ObjectiveId): MasteryState {
    return learner.objectives[id]?.state ?? "new";
  }

  /** Every objective's state, for the mind map. */
  objectiveStates(learner: LearnerState): Record<ObjectiveId, MasteryState> {
    return Object.fromEntries(Object.values(learner.objectives).map((p) => [p.objectiveId, p.state]));
  }

  conceptState(learner: LearnerState, concept: Concept): MasteryState {
    return conceptState(concept.objectives.map((o) => this.objectiveState(learner, o.id)));
  }

  /** Studied: every objective attempted. */
  studied(learner: LearnerState, concept: Concept) {
    return concept.objectives.every((o) => this.objectiveState(learner, o.id) !== "new");
  }

  unfinishedPrerequisites(learner: LearnerState, concept: Concept): Concept[] {
    return concept.prerequisites
      .map((id) => this.concepts.get(id))
      .filter((c): c is Concept => !!c && !this.studied(learner, c));
  }

  /** The goal challenge's score at one stage, or undefined if it wasn't taken. */
  challengeScore(learner: LearnerState, stage: "before" | "after") {
    const answers = learner.challenge[stage];
    const challenges = this.course.challenges ?? [];
    if (!answers?.length || !challenges.length) return undefined;
    return { right: challenges.filter((c, i) => answers[i] === c.answerIndex).length, of: challenges.length };
  }

  /** Every objective of the concept was in a goal challenge the learner got right before starting. */
  knownBefore(learner: LearnerState, concept: Concept) {
    const answers = learner.challenge.before ?? [];
    const right = new Set((this.course.challenges ?? []).flatMap((c, i) => (answers[i] === c.answerIndex ? c.objectiveIds : [])));
    return concept.objectives.length > 0 && concept.objectives.every((o) => right.has(o.id));
  }

  /** How often "Sure" was right, and the objectives where it wasn't (PLAN.md §3, confidence). */
  calibration(learner: LearnerState) {
    const sure = learner.attempts.filter((a) => a.confidence === "sure");
    return {
      sure: sure.length,
      sureRight: sure.filter((a) => a.correct).length,
      surprises: [...new Set(sure.filter((a) => !a.correct).map((a) => a.objectiveId))],
    };
  }

  summary(learner: LearnerState) {
    const concepts = this.course.plan.concepts.filter((c) => this.available.has(c.id));
    const objectives = concepts.flatMap((c) => c.objectives);
    const chosen = this.course.spans.filter((s) => s.rank === 0);
    const seconds = (spans: Span[]) => spans.reduce((t, s) => t + (s.end - s.start), 0);
    return {
      studied: concepts.filter((c) => this.studied(learner, c)).length,
      concepts: concepts.length,
      mastery: tally(objectives.map((o) => this.objectiveState(learner, o.id))),
      objectives: objectives.length,
      watchedMinutes: Math.round(seconds(chosen.filter((s) => learner.watched.includes(s.id))) / 60),
      totalMinutes: Math.round(seconds(chosen) / 60),
    };
  }
}

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
