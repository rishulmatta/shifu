// What the coach's changes need from the pipeline (PLAN.md §3, "The course coach"): more practice
// questions written from an objective's clips, and a prerequisite concept built from new clips
// through the same steps as a course build (find videos, read captions, locate, choose, recall).

import { addUsage, type Usage, ZERO } from "../models/router";
import type { OverlayPatch } from "../overlay";
import type { BuildProgress, BuildStep } from "../store/types";
import type { CaptionLine, CheckItem, Concept, CoursePlan, Objective, ObjectiveId, Span } from "../types";
import { conceptBlocks } from "./assemble";
import { buildConcepts, type Sources } from "./build";
import { textInSeconds } from "./captions";
import { writePractice } from "./recall";

export interface PracticeInput {
  objectives: Objective[];
  /** The learner's spans for those objectives: the chosen one and alternates. */
  spans: Span[];
  /** Prompts already asked per objective, so the new questions differ. */
  asked: Record<ObjectiveId, string[]>;
  count: number;
  captions: (videoId: string) => Promise<CaptionLine[] | null>;
}

/** `count` questions spread over the objectives, from each one's chosen clip, then its alternate. */
export async function writePracticeFor(input: PracticeInput, tag: string) {
  const per = Math.ceil(input.count / input.objectives.length);
  let usage: Usage = ZERO;
  const items: CheckItem[] = [];
  const warnings: string[] = [];
  await Promise.all(
    input.objectives.map(async (o) => {
      const mine = input.spans.filter((s) => s.objectiveId === o.id && s.rank <= 1).sort((a, b) => a.rank - b.rank);
      const clips = (
        await Promise.all(
          mine.map(async (span) => {
            const lines = await input.captions(span.videoId).catch(() => null);
            return lines ? { span, text: textInSeconds(lines, span.start, span.end) } : undefined;
          }),
        )
      ).filter((c) => !!c?.text);
      if (!clips.length) return warnings.push(`no captions for the clips of "${o.text}"`);
      const r = await writePractice(o, clips as { span: Span; text: string }[], per, input.asked[o.id] ?? [], `${tag}-`);
      usage = addUsage(usage, r.usage);
      items.push(...(r.items as CheckItem[]));
      warnings.push(...r.dropped);
    }),
  );
  return { items: items.slice(0, input.count), usage, warnings };
}

/**
 * Builds one new concept from fresh clips and returns it as an overlay patch: the concept with its
 * place (before the concept that will build on it, or after the one it builds on), its videos,
 * spans, questions and cards, and its blocks. Throws when no clip teaches any of its objectives.
 */
export async function growConcept(
  plan: CoursePlan,
  concept: Concept,
  place: { before?: string; after?: string },
  sources: Sources,
  onProgress: (message: string, step?: BuildStep) => void,
): Promise<{ patch: OverlayPatch; usage: Usage; warnings: string[] }> {
  const warnings: string[] = [];
  const report = async (p: Partial<BuildProgress>) => {
    if (p.message) onProgress(p.message, p.step);
  };
  const withIt = { ...plan, concepts: [...plan.concepts, concept] };
  const built = await buildConcepts(withIt, [concept], `"${concept.title}"`, sources, report, (m) => warnings.push(m));
  const blocks = conceptBlocks(concept, built.spans, built.items);
  if (!blocks.length) throw new Error(`No clip teaches "${concept.title}" well enough`);
  return {
    patch: { concept, ...place, videos: built.videos, spans: built.spans, items: built.items, blocks },
    usage: built.usage,
    warnings,
  };
}
