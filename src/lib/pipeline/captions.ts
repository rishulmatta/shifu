// Caption-line helpers shared by the locate, verify and recall steps (PLAN.md §6).
// Models see numbered lines and answer with line numbers; these helpers turn that into seconds and
// check quotes against what was actually said.

import type { CaptionLine } from "../types";

/** "L12 [3:04] text", one per line: the format every span-finding prompt uses. */
export function numberLines(lines: CaptionLine[]): string {
  return lines.map((l, i) => `L${i + 1} [${stamp(l.start)}] ${l.text.replace(/\s+/g, " ").trim()}`).join("\n");
}

const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Seconds covered by lines first..last (1-based, inclusive). */
export function linesToSeconds(lines: CaptionLine[], first: number, last: number) {
  const a = lines[first - 1];
  const b = lines[last - 1];
  return { start: a.start, end: b.start + b.duration };
}

/** The words spoken in lines first..last (1-based, inclusive). */
export function textOf(lines: CaptionLine[], first: number, last: number) {
  return lines
    .slice(first - 1, last)
    .map((l) => l.text)
    .join(" ");
}

/** The words spoken in lines that start inside [start, end) seconds. */
export function textInSeconds(lines: CaptionLine[], start: number, end: number) {
  return lines
    .filter((l) => l.start >= start && l.start < end)
    .map((l) => l.text)
    .join(" ");
}

/** Lowercase words without punctuation, so a model's tidied quote can match raw auto-captions. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Whether `quote` was said in `text`: its words appear in order, allowing a few to differ
 * (captions mishear, models tidy). The share of the quote's words found must reach `threshold`.
 */
export function quoteFound(text: string, quote: string, threshold = 0.8): boolean {
  const q = words(quote);
  const t = words(text);
  if (q.length === 0) return false;
  if (` ${t.join(" ")} `.includes(` ${q.join(" ")} `)) return true;
  // Longest common subsequence of words, restricted to windows no longer than 1.5× the quote.
  const window = Math.ceil(q.length * 1.5);
  let best = 0;
  for (let start = 0; start < t.length; start++) {
    if (t[start] !== q[0] && t[start] !== q[1]) continue;
    const slice = t.slice(start, start + window);
    const dp = new Array(q.length + 1).fill(0);
    for (const w of slice) {
      for (let j = q.length; j >= 1; j--) if (q[j - 1] === w) dp[j] = Math.max(dp[j], dp[j - 1] + 1);
      for (let j = 1; j <= q.length; j++) dp[j] = Math.max(dp[j], dp[j - 1]);
    }
    best = Math.max(best, dp[q.length]);
  }
  return best / q.length >= threshold;
}
