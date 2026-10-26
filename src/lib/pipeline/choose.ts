// Step 6 of the build pipeline (PLAN.md §6): for each objective, the best verified span and up to two
// alternates from other videos (the "explain it differently" pool). Deterministic for now: coverage
// of the must-include points first, then self-containedness, then a watchable length.

import type { Objective, Span, Video } from "../types";
import type { Candidate } from "./locate";

const IDEAL_S = 120;

export function score(c: Candidate, mustIncludeCount: number): number {
  const coverage = c.covers.length / Math.max(1, mustIncludeCount);
  const fit = 1 - Math.min(1, Math.abs(c.end - c.start - IDEAL_S) / 180);
  return coverage * 2 + (c.selfContained ? 1 : 0) + fit * 0.5;
}

/**
 * Ranks an objective's candidates. Alternates must come from a different video, and from a
 * different channel when one is available, so a second explanation really is different.
 */
export function chooseSpans(objective: Objective, candidates: Candidate[], videos: Record<string, Video>): Span[] {
  const ranked = candidates
    .filter((c) => c.objectiveId === objective.id)
    .map((c, order) => ({ c, s: score(c, objective.mustInclude.length), order }))
    .sort((a, b) => b.s - a.s || a.order - b.order)
    .map((x) => x.c);
  if (!ranked.length) return [];

  const picked = [ranked[0]];
  const channel = (c: Candidate) => videos[c.videoId]?.channel;
  for (const preferNewChannel of [true, false]) {
    for (const c of ranked) {
      if (picked.length === 3) break;
      if (picked.includes(c) || picked.some((p) => p.videoId === c.videoId)) continue;
      if (preferNewChannel && picked.some((p) => channel(p) === channel(c))) continue;
      picked.push(c);
    }
  }

  return picked.map((c, rank) => ({
    id: `${objective.id}#${rank}`,
    objectiveId: objective.id,
    videoId: c.videoId,
    start: c.start,
    end: c.end,
    rank: rank as 0 | 1 | 2,
    covers: c.covers.map((i) => objective.mustInclude[i]).filter(Boolean),
    selfContained: c.selfContained,
  }));
}
