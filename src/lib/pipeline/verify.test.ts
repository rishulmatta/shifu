import { describe, expect, it } from "vitest";
import type { CaptionLine } from "../types";
import { linesToSeconds, numberLines, quoteFound, textOf } from "./captions";
import { leansBack, verifySpan } from "./verify";

// Ten-second lines.
const lines: CaptionLine[] = [
  "so today we're going to talk about updating beliefs",
  "the prior is what you believed before any evidence",
  "then you ask how likely the evidence is if you're right",
  "that's the likelihood and you multiply the prior by it",
  "then divide by how likely the evidence was overall",
  "and that gives you the posterior probability",
  "anyway thanks to today's sponsor for supporting the channel",
].map((text, i) => ({ start: i * 10, duration: 10, text }));

const proposal = { firstLine: 2, lastLine: 6, covers: [0, 1], selfContained: true, quote: "Then divide by how likely the evidence was overall." };

describe("captions", () => {
  it("numbers lines with timestamps", () => {
    expect(numberLines(lines).split("\n")[1]).toBe("L2 [0:10] the prior is what you believed before any evidence");
  });

  it("turns inclusive line numbers into seconds", () => {
    expect(linesToSeconds(lines, 2, 6)).toEqual({ start: 10, end: 60 });
    expect(textOf(lines, 4, 4)).toBe(lines[3].text);
  });

  it("matches a tidied quote against raw captions, in order", () => {
    const text = textOf(lines, 1, 7);
    expect(quoteFound(text, "That's the likelihood, and you multiply the prior by it!")).toBe(true);
    expect(quoteFound(text, "That's the likelihood and you multiply prior by it")).toBe(true);
    expect(quoteFound(text, "the posterior is the area of the rectangle")).toBe(false);
    expect(quoteFound(text, "")).toBe(false);
  });
});

describe("leansBack", () => {
  it("spots openings that depend on what came before", () => {
    expect(leansBack("That's the likelihood")).toBe(true);
    expect(leansBack("As we saw earlier, the prior")).toBe(true);
    expect(leansBack("The prior is what you believed")).toBe(false);
    expect(leansBack("Thermodynamics is")).toBe(false);
  });

  it("ignores spoken fillers", () => {
    expect(leansBack("so the prior is")).toBe(false);
    expect(leansBack("and then you divide")).toBe(false);
  });
});

describe("verifySpan", () => {
  it("accepts a good span and converts it to seconds", () => {
    const v = verifySpan(lines, proposal, 2);
    expect(v).toEqual({ ok: true, span: { firstLine: 2, lastLine: 6, start: 10, end: 60, covers: [0, 1], selfContained: true }, notes: [] });
  });

  it("drops a span whose quote was not said inside it", () => {
    const v = verifySpan(lines, { ...proposal, quote: "thanks to today's sponsor" }, 2);
    expect(v).toMatchObject({ ok: false, reason: "the quote was not said inside the span" });
  });

  it("drops impossible line numbers", () => {
    expect(verifySpan(lines, { ...proposal, lastLine: 9 }, 2).ok).toBe(false);
    expect(verifySpan(lines, { ...proposal, firstLine: 5, lastLine: 3 }, 2).ok).toBe(false);
  });

  it("pulls back a span that opens mid-thought", () => {
    const v = verifySpan(lines, { ...proposal, firstLine: 4, quote: "multiply the prior" }, 2);
    expect(v.ok && v.span.firstLine).toBe(3);
    expect(v.ok && v.span.selfContained).toBe(true);
  });

  it("flags a span that still opens mid-thought after pulling back as far as it can", () => {
    const chain: CaptionLine[] = ["intro", "it builds on that", "this follows", "that means", "they combine", "into the posterior"].map(
      (text, i) => ({ start: i * 10, duration: 10, text }),
    );
    const v = verifySpan(chain, { ...proposal, firstLine: 5, lastLine: 6, quote: "they combine" }, 2);
    expect(v.ok && v.span.firstLine).toBe(2);
    expect(v.ok && v.span.selfContained).toBe(false);
  });

  it("never flags the video's first line", () => {
    const v = verifySpan(lines, { ...proposal, firstLine: 1, quote: "updating beliefs" }, 2);
    expect(v.ok && v.span.selfContained).toBe(true);
  });

  it("drops spans that are too short or too long", () => {
    expect(verifySpan(lines, { ...proposal, firstLine: 2, lastLine: 2, quote: "the prior is what you believed" }, 2)).toMatchObject({ ok: false });
    const long = Array.from({ length: 40 }, (_, i) => ({ start: i * 10, duration: 10, text: `point number ${i}` }));
    expect(verifySpan(long, { ...proposal, firstLine: 1, lastLine: 40, quote: "point number 3" }, 2)).toMatchObject({ ok: false });
  });

  it("keeps only valid must-include indexes", () => {
    const v = verifySpan(lines, { ...proposal, covers: [0, 0, 5, -1] }, 2);
    expect(v.ok && v.span.covers).toEqual([0]);
  });
});
