// Runs locate → verify → choose → recall on the two test transcripts and prints what each step kept,
// what it dropped and why, and the cost. Run: pnpm try:clips

import { addUsage, ZERO } from "../src/lib/models/router";
import { textInSeconds } from "../src/lib/pipeline/captions";
import { chooseSpans } from "../src/lib/pipeline/choose";
import { type Candidate, locateInVideo } from "../src/lib/pipeline/locate";
import { writeRecall } from "../src/lib/pipeline/recall";
import { bayesCourse } from "../src/lib/fixtures/bayes";
import { areaPicture, lecture } from "./fixtures/captions.mjs";

const objectives = bayesCourse.plan.concepts.find((c) => c.id === "bayes-rule")!.objectives;
const sources = [lecture, areaPicture];
const videos = Object.fromEntries(sources.map((s) => [s.video.id, s.video]));
const lines = Object.fromEntries(sources.map((s) => [s.video.id, s.lines]));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const started = Date.now();
let usage = ZERO;

console.log("# Locate (one call per video, in parallel)");
const located = await Promise.all(sources.map((s) => locateInVideo(s.video, s.lines, objectives)));
const candidates: Candidate[] = [];
located.forEach((l, i) => {
  usage = addUsage(usage, l.usage);
  candidates.push(...l.candidates);
  for (const c of l.candidates) {
    console.log(`  ${sources[i].video.id} → ${c.objectiveId}: ${clock(c.start)}–${clock(c.end)} covers [${c.covers}] self-contained ${c.selfContained} ${c.notes.join("; ")}`);
  }
  for (const r of l.rejected) console.log(`  ${sources[i].video.id} → ${r.objectiveId}: REJECTED (${r.reason})`);
});

console.log("\n# Choose and write recall");
for (const o of objectives) {
  const spans = chooseSpans(o, candidates, videos);
  if (!spans.length) {
    console.log(`\n## ${o.id}: no span`);
    continue;
  }
  console.log(`\n## ${o.id}: ${spans.map((s) => `#${s.rank} ${s.videoId} ${clock(s.start)}–${clock(s.end)}`).join(", ")}`);
  const clip = (i: number) => spans[i] && { span: spans[i], text: textInSeconds(lines[spans[i].videoId], spans[i].start, spans[i].end) };
  const recall = await writeRecall(o, clip(0)!, clip(1));
  usage = addUsage(usage, recall.usage);
  for (const item of recall.items) {
    if (item.kind === "mcq") console.log(`  Q ${item.prompt}\n    ${item.options.map((x, i) => (i === item.answerIndex ? `[${x}]` : x)).join(" | ")}`);
    else console.log(`  Card: ${item.front} → ${item.back}`);
  }
  for (const d of recall.dropped) console.log(`  dropped: ${d}`);
}

console.log(
  `\n${((Date.now() - started) / 1000).toFixed(1)} s · ${usage.inputTokens} in / ${usage.outputTokens} out (${usage.reasoningTokens} reasoning) · $${usage.costUsd.toFixed(4)}`,
);
