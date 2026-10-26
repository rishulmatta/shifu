import { describe, expect, it } from "vitest";
import type { Objective, Video } from "../types";
import { chooseSpans } from "./choose";
import type { Candidate } from "./locate";
import { shuffleOptions, unlabel } from "./recall";

const objective: Objective = { id: "bayes-rule/1", conceptId: "bayes-rule", text: "Compute a posterior", mustInclude: ["multiply", "divide"] };
const video = (id: string, channel: string): Video => ({ id, title: id, channel, durationS: 600 });
const videos = { a: video("a", "Ann"), b: video("b", "Ann"), c: video("c", "Cy"), d: video("d", "Di") };

const candidate = (videoId: string, covers: number[], seconds = 120, selfContained = true): Candidate => ({
  objectiveId: objective.id,
  videoId,
  firstLine: 1,
  lastLine: 10,
  start: 0,
  end: seconds,
  covers,
  selfContained,
  notes: [],
});

describe("chooseSpans", () => {
  it("puts the span covering the most must-include points first", () => {
    const spans = chooseSpans(objective, [candidate("a", [0]), candidate("c", [0, 1])], videos);
    expect(spans.map((s) => [s.videoId, s.rank])).toEqual([
      ["c", 0],
      ["a", 1],
    ]);
    expect(spans[0].covers).toEqual(["multiply", "divide"]);
  });

  it("prefers self-contained spans when coverage ties", () => {
    const spans = chooseSpans(objective, [candidate("a", [0, 1], 120, false), candidate("c", [0, 1])], videos);
    expect(spans[0].videoId).toBe("c");
  });

  it("takes alternates from other channels first, then other videos", () => {
    const spans = chooseSpans(objective, [candidate("a", [0, 1]), candidate("b", [0, 1]), candidate("c", [0])], videos);
    expect(spans.map((s) => s.videoId)).toEqual(["a", "c", "b"]);
  });

  it("never offers the same video twice and stops at three", () => {
    const spans = chooseSpans(objective, ["a", "a", "b", "c", "d"].map((v) => candidate(v, [0])), videos);
    expect(new Set(spans.map((s) => s.videoId)).size).toBe(3);
    expect(spans.map((s) => s.id)).toEqual(["bayes-rule/1#0", "bayes-rule/1#1", "bayes-rule/1#2"]);
  });

  it("returns nothing when no candidate exists", () => {
    expect(chooseSpans(objective, [], videos)).toEqual([]);
  });
});

describe("shuffleOptions", () => {
  it("moves the answer with its option and is stable for a seed", () => {
    const opts = ["right", "w1", "w2", "w3"];
    const a = shuffleOptions(opts, 0, "seed-1");
    expect(a.options[a.answerIndex]).toBe("right");
    expect(shuffleOptions(opts, 0, "seed-1")).toEqual(a);
    expect([...a.options].sort()).toEqual([...opts].sort());
  });

  it("spreads answers across positions", () => {
    const positions = new Set(Array.from({ length: 40 }, (_, i) => shuffleOptions(["r", "a", "b", "c"], 0, `q${i}`).answerIndex));
    expect(positions.size).toBe(4);
  });
});

describe("unlabel", () => {
  it("strips option letters and numbers but keeps real content", () => {
    expect(["B) The share left", "a. Odds", "3: Ratio", "D - Prior", "4 ways to see it", "A priori"].map(unlabel)).toEqual([
      "The share left",
      "Odds",
      "Ratio",
      "Prior",
      "4 ways to see it",
      "A priori",
    ]);
  });
});
