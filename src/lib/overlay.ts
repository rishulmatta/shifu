// A learner's own additions to a course (PLAN.md §3, "The course coach"): concepts, clips and
// questions the coach added for this learner. They live in the learner's browser beside their
// progress and are merged into the course the player and the mind map see; the shared course is
// never changed, so one learner's coaching doesn't reshape the course for everyone with the link.

import type { Block, Concept, ConceptId, Course, RecallItem, Span, Video } from "./types";

/** Blocks placed after the block with key `after` ("^" places them at the very start). */
export interface Insertion {
  after: string;
  blocks: Block[];
}

export interface Overlay {
  concepts: Concept[];
  /** Prerequisite links added to the course's own concepts: `conceptId` now builds on `prerequisiteId`. */
  links: { conceptId: ConceptId; prerequisiteId: ConceptId }[];
  videos: Record<string, Video>;
  spans: Span[];
  items: RecallItem[];
  insertions: Insertion[];
}

export const NO_OVERLAY: Overlay = { concepts: [], links: [], videos: {}, spans: [], items: [], insertions: [] };

/** What one coach action adds. `concept` with `before` is a new prerequisite of that concept. */
export interface OverlayPatch {
  concept?: Concept;
  before?: ConceptId;
  videos?: Video[];
  spans?: Span[];
  items?: RecallItem[];
  blocks?: Block[];
}

export interface Merged {
  course: Course;
  /** One stable key per timeline block: "b3" for the course's fourth block, "x2:0" for an added one. */
  keys: string[];
}

export function mergeCourse(course: Course, o: Overlay): Merged {
  const timeline = [...course.timeline];
  const keys = course.timeline.map((_, i) => `b${i}`);
  // Each insertion goes straight after its anchor, so the newest addition is the next thing seen.
  o.insertions.forEach((ins, n) => {
    // An anchor that isn't there any more (a course rebuilt since) puts the blocks at the end.
    const anchor = ins.after === "^" ? -1 : keys.indexOf(ins.after);
    const where = ins.after !== "^" && anchor === -1 ? timeline.length : anchor + 1;
    timeline.splice(where, 0, ...ins.blocks);
    keys.splice(where, 0, ...ins.blocks.map((_, j) => `x${n}:${j}`));
  });

  if (!o.concepts.length && !o.links.length && !o.items.length) return { course: { ...course, timeline }, keys };

  const prerequisites = (c: Concept) => [...c.prerequisites, ...o.links.filter((l) => l.conceptId === c.id).map((l) => l.prerequisiteId)];
  const concepts = [...course.plan.concepts, ...o.concepts].map((c) => ({ ...c, prerequisites: prerequisites(c) }));
  // An added concept sits in its module just before the first concept that builds on it.
  const modules = course.plan.modules.map((m) => {
    const ids = [...m.conceptIds];
    for (const c of o.concepts) {
      if (c.moduleIndex !== m.index || ids.includes(c.id)) continue;
      const builder = o.links.find((l) => l.prerequisiteId === c.id && ids.includes(l.conceptId));
      ids.splice(builder ? ids.indexOf(builder.conceptId) : ids.length, 0, c.id);
    }
    return { ...m, conceptIds: ids };
  });

  return {
    course: {
      ...course,
      plan: { ...course.plan, concepts, modules },
      videos: { ...course.videos, ...o.videos },
      spans: [...course.spans, ...o.spans.filter((s) => !course.spans.some((t) => t.id === s.id))],
      items: [...course.items, ...o.items.filter((i) => !course.items.some((t) => t.id === i.id))],
      timeline,
    },
    keys,
  };
}

/**
 * Adds a coach's patch to the overlay, its blocks placed after the block keyed `after`. A new
 * concept arrives first without blocks (so the map can show it building) and again with them.
 */
export function applyPatch(o: Overlay, patch: OverlayPatch, after: string): Overlay {
  const concept = patch.concept;
  const known = concept && o.concepts.some((c) => c.id === concept.id);
  return {
    concepts: concept && !known ? [...o.concepts, concept] : o.concepts,
    links:
      concept && patch.before && !o.links.some((l) => l.prerequisiteId === concept.id)
        ? [...o.links, { conceptId: patch.before, prerequisiteId: concept.id }]
        : o.links,
    videos: { ...o.videos, ...Object.fromEntries((patch.videos ?? []).map((v) => [v.id, v])) },
    spans: [...o.spans, ...(patch.spans ?? [])],
    items: [...o.items, ...(patch.items ?? [])],
    insertions: patch.blocks?.length ? [...o.insertions, { after, blocks: patch.blocks }] : o.insertions,
  };
}

/** Takes back a concept that never got its blocks (the coach couldn't find a clip for it). */
export function dropConcept(o: Overlay, id: ConceptId): Overlay {
  return { ...o, concepts: o.concepts.filter((c) => c.id !== id), links: o.links.filter((l) => l.prerequisiteId !== id) };
}
