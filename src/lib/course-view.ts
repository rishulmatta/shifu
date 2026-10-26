// Read-only lookups over a course and a learner's progress, shared by the player and the outline.

import { conceptState, tally } from "./mastery";
import type { LearnerState } from "./learner";
import type { Concept, Course, MasteryState, ObjectiveId, RecallItem, Span } from "./types";

export class CourseView {
  readonly concepts: Map<string, Concept>;
  readonly spans: Map<string, Span>;
  readonly items: Map<string, RecallItem>;

  constructor(readonly course: Course) {
    this.concepts = new Map(course.plan.concepts.map((c) => [c.id, c]));
    this.spans = new Map(course.spans.map((s) => [s.id, s]));
    this.items = new Map(course.items.map((i) => [i.id, i]));
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

  summary(learner: LearnerState) {
    const concepts = this.course.plan.concepts;
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
