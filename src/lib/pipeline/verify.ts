// Step 5 of the build pipeline (PLAN.md §6): deterministic checks on every span a model proposes.
// No model call: line numbers must be real, the quote must have been said inside the span, the
// length must be watchable, and a span that opens mid-thought is pulled back or flagged.

import type { CaptionLine } from "../types";
import { linesToSeconds, quoteFound, textOf, words } from "./captions";

export const SPAN = { minS: 20, maxS: 300, maxPullbackLines: 3 };

/** What the locate step proposes for one objective in one video. */
export interface Proposal {
  firstLine: number;
  lastLine: number;
  /** Indexes into the objective's must-include points. */
  covers: number[];
  selfContained: boolean;
  quote: string;
}

export interface Checked {
  firstLine: number;
  lastLine: number;
  start: number;
  end: number;
  covers: number[];
  selfContained: boolean;
}

export type Verdict = { ok: true; span: Checked; notes: string[] } | { ok: false; reason: string };

/**
 * Openings that refer back to something said before the span. Spoken fillers ("so", "and", "then")
 * are left out: captions start with them constantly without depending on what came before.
 */
const LEANS_BACK = [
  "that",
  "thats",
  "this",
  "these",
  "those",
  "it",
  "its",
  "they",
  "which",
  "but",
  "now that",
  "as we saw",
  "as i said",
  "like i said",
  "as i mentioned",
  "remember",
  "same thing",
];

export function leansBack(text: string): boolean {
  const w = words(text).slice(0, 3).join(" ");
  return LEANS_BACK.some((p) => w === p || w.startsWith(`${p} `));
}

export function verifySpan(lines: CaptionLine[], p: Proposal, mustIncludeCount: number): Verdict {
  const n = lines.length;
  if (!Number.isInteger(p.firstLine) || !Number.isInteger(p.lastLine)) return { ok: false, reason: "line numbers are not integers" };
  if (p.firstLine < 1 || p.lastLine > n || p.firstLine > p.lastLine) {
    return { ok: false, reason: `lines ${p.firstLine}-${p.lastLine} are outside 1-${n}` };
  }
  if (!quoteFound(textOf(lines, p.firstLine, p.lastLine), p.quote)) {
    return { ok: false, reason: "the quote was not said inside the span" };
  }

  const notes: string[] = [];
  let first = p.firstLine;
  let selfContained = p.selfContained;
  while (leansBack(lines[first - 1].text) && first > 1 && p.firstLine - first < SPAN.maxPullbackLines) first--;
  if (first !== p.firstLine) notes.push(`pulled the start back ${p.firstLine - first} line(s) to keep the context`);
  // The video's first line has nothing before it to lean on.
  if (first > 1 && leansBack(lines[first - 1].text)) {
    selfContained = false;
    notes.push("still opens mid-thought");
  }

  const { start, end } = linesToSeconds(lines, first, p.lastLine);
  if (end - start < SPAN.minS) return { ok: false, reason: `only ${Math.round(end - start)} s long` };
  if (end - start > SPAN.maxS) return { ok: false, reason: `${Math.round(end - start)} s is too long to be one clip` };

  const covers = [...new Set(p.covers.filter((i) => Number.isInteger(i) && i >= 0 && i < mustIncludeCount))];
  return { ok: true, span: { firstLine: first, lastLine: p.lastLine, start, end, covers, selfContained }, notes };
}
