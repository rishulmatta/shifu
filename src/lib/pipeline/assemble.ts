// Step 8 of the build pipeline (PLAN.md §6): turn the plan, the chosen spans and the recall items
// into the course timeline the player walks through (the learner's path, PLAN.md §3).

import type { Block, CoursePlan, ObjectiveId, RecallItem, Span } from "../types";

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
  const chosen = new Map(spans.filter((s) => s.rank === 0).map((s) => [s.objectiveId, s]));
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
      blocks.push({ kind: "intro", conceptId });
      for (const o of concept.objectives) {
        const span = chosen.get(o.id);
        const check = checksFor(items, o.id)[0];
        if (!span || !check) continue;
        blocks.push({ kind: "clip", objectiveId: o.id, spanId: span.id });
        blocks.push({ kind: "check", objectiveId: o.id, itemId: check.id });
        inModule.push(o.id);
      }
      const cards = items.filter((i) => i.kind === "card" && i.objectiveId.startsWith(`${conceptId}/`));
      if (cards.length) blocks.push({ kind: "cards", conceptId, itemIds: cards.map((c) => c.id) });
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
