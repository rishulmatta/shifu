// Step 8 of the build pipeline (PLAN.md §6): turn the plan, the chosen spans and the recall items
// into the course timeline the player walks through (the learner's path, PLAN.md §3).

import type { Block, Concept, CoursePlan, ObjectiveId, RecallItem, Span } from "../types";

/** How many earlier-module questions each end-of-module quiz mixes in. */
const EARLIER_IN_QUIZ = 2;

export function checksFor(items: RecallItem[], objectiveId: ObjectiveId) {
  return items.filter((i) => i.kind === "mcq" && i.objectiveId === objectiveId);
}

/**
 * Per concept: an intro, then for each objective its chosen clip and a check question, then the
 * concept's flashcards. Per module: a teach-back and a mixed quiz. An objective with no chosen span
 * or no check question is skipped rather than failing the course.
 *
 * Each objective's check questions are used in order: the first after the clip, the second after
 * "explain it differently" (the player picks it), the third (or else the second) in the quiz.
 */
export function assembleTimeline(plan: CoursePlan, spans: Span[], items: RecallItem[]): Block[] {
  const concepts = new Map(plan.concepts.map((c) => [c.id, c]));
  const quizPick = (id: ObjectiveId) => {
    const checks = checksFor(items, id);
    return checks[2] ?? checks[1] ?? checks[0];
  };

  const blocks: Block[] = [];
  const taught: ObjectiveId[] = [];

  for (const mod of [...plan.modules].sort((a, b) => a.index - b.index)) {
    const inModule: ObjectiveId[] = [];
    for (const conceptId of mod.conceptIds) {
      const concept = concepts.get(conceptId);
      if (!concept) continue;
      const own = conceptBlocks(concept, spans, items);
      blocks.push(...own);
      for (const b of own) if (b.kind === "check") inModule.push(b.objectiveId);
    }
    if (!inModule.length) continue;

    blocks.push({ kind: "teachback", moduleIndex: mod.index });
    const earlier = taught.slice(-EARLIER_IN_QUIZ);
    const quiz = [...inModule, ...earlier].map(quizPick).filter((i) => i !== undefined);
    blocks.push({ kind: "quiz", moduleIndex: mod.index, itemIds: quiz.map((i) => i.id) });
    taught.push(...inModule);
  }
  return blocks;
}

/**
 * One concept's blocks: its intro, each objective's chosen clip and first check question, then its
 * flashcards. Empty when nothing in it has a clip and a question: such a concept is left out
 * rather than shown empty.
 */
export function conceptBlocks(concept: Concept, spans: Span[], items: RecallItem[]): Block[] {
  const playable = concept.objectives.flatMap((o) => {
    const span = spans.find((s) => s.objectiveId === o.id && s.rank === 0);
    const check = checksFor(items, o.id)[0];
    return span && check ? [{ id: o.id, span, check }] : [];
  });
  if (!playable.length) return [];
  const blocks: Block[] = [{ kind: "intro", conceptId: concept.id }];
  for (const p of playable) {
    blocks.push({ kind: "clip", objectiveId: p.id, spanId: p.span.id });
    blocks.push({ kind: "check", objectiveId: p.id, itemId: p.check.id });
  }
  const cards = items.filter((i) => i.kind === "card" && i.objectiveId.startsWith(`${concept.id}/`));
  if (cards.length) blocks.push({ kind: "cards", conceptId: concept.id, itemIds: cards.map((c) => c.id) });
  return blocks;
}
