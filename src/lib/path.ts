// The course as the learner walks it, grouped for the progression beside the lesson: one group per
// concept (its intro, clips, checks and cards), and one for each block that stands alone (the goal
// challenge, a teach-back, a chapter quiz). A concept the coach is still building sits where it
// will land.

import type { CourseView } from "./course-view";
import type { Merged } from "./overlay";
import type { Block, Concept } from "./types";

export interface PathItem {
  index: number;
  key: string;
  block: Block;
}

/** One group of the path: a concept with its blocks, or a block that stands alone (quiz, teach-back, challenge). */
export interface PathGroup {
  id: string;
  title: string;
  concept?: Concept;
  moduleIndex?: number;
  items: PathItem[];
  /** The coach is still building this concept: on the path, nothing to play yet. */
  pending?: boolean;
}

/** Concepts the coach is building, and the concept each one will come before. */
export interface PendingConcept {
  concept: Concept;
  before?: string;
}

export function groupPath(merged: Merged, view: CourseView, pending: PendingConcept[]): PathGroup[] {
  const { timeline } = merged.course;
  const groups: PathGroup[] = [];
  let open: PathGroup | null = null;
  const standalone = (id: string, title: string, item: PathItem, moduleIndex?: number) => {
    groups.push({ id, title, items: [item], moduleIndex });
    open = null;
  };
  timeline.forEach((block, index) => {
    const item = { index, key: merged.keys[index], block };
    if (block.kind === "intro") {
      const concept = view.concepts.get(block.conceptId);
      open = { id: block.conceptId, title: concept?.title ?? block.conceptId, concept, moduleIndex: concept?.moduleIndex, items: [item] };
      groups.push(open);
    } else if (block.kind === "challenge") standalone(`challenge-${block.stage}`, block.stage === "before" ? "Goal challenge" : "Goal challenge, again", item);
    else if (block.kind === "teachback") standalone(`teachback-${block.moduleIndex}`, "Teach it back", item, block.moduleIndex);
    else if (block.kind === "quiz") standalone(`quiz-${block.moduleIndex}`, "Chapter quiz", item, block.moduleIndex);
    else if (open) open.items.push(item);
    else {
      open = { id: `start-${index}`, title: "To begin", items: [item] };
      groups.push(open);
    }
  });
  // A concept still being built sits where it will land: before the concept that needs it.
  for (const p of pending) {
    const group: PathGroup = { id: p.concept.id, title: p.concept.title, concept: p.concept, moduleIndex: p.concept.moduleIndex, items: [], pending: true };
    const at = p.before ? groups.findIndex((g) => g.id === p.before) : -1;
    groups.splice(at < 0 ? groups.length : at, 0, group);
  }
  return groups;
}
