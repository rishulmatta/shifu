// Runs the whole build end to end on the model providers, with test video sources: every search
// returns the two hand-written test transcripts. Proves the orchestration before the SearchAPI key
// exists. Run: pnpm try:build ["topic"]

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCourse, newRecord, type Sources } from "../src/lib/pipeline/build";
import { FileStore } from "../src/lib/store/file";
import { areaPicture, lecture } from "./fixtures/captions.mjs";

const fixtures = [lecture, areaPicture];
const sources: Sources = {
  // The test transcripts are short; stretch their durations past the 3-minute filter.
  search: async () => fixtures.map((f) => ({ id: f.video.id, title: f.video.title, channel: f.video.channel, durationS: 600, views: 1 })),
  embeddable: async () => true,
  captions: async (id) => {
    const lines = fixtures.find((f) => f.video.id === id)?.lines ?? null;
    // Repeat lines so the transcript clears the minimum-length filter, as a long video would.
    return lines && [...lines, ...lines.map((l) => ({ ...l, start: l.start + 200 }))];
  },
};

const store = new FileStore(await mkdtemp(join(tmpdir(), "shifu-build-")));
const topic = process.argv[2] ?? "Bayes' theorem";
const input = { topic, goal: "Understand how evidence should change what I believe", level: "beginner" as const, minutesPerDay: 10 };
await store.createCourse(newRecord("try", input));

const started = Date.now();
const timer = setInterval(async () => {
  const r = await store.getCourse("try");
  if (r) console.log(`  [${((Date.now() - started) / 1000).toFixed(0)} s] ${r.progress.step}: ${r.progress.message} (${r.progress.modulesReady}/${r.progress.modulesTotal})`);
}, 3000);
await buildCourse("try", input, sources, store);
clearInterval(timer);

const r = (await store.getCourse("try"))!;
const c = r.course;
console.log(`\n${r.progress.step} in ${((Date.now() - started) / 1000).toFixed(1)} s · $${r.progress.costUsd.toFixed(4)} · ${r.progress.message}`);
if (c) {
  const kinds = c.timeline.reduce<Record<string, number>>((t, b) => ({ ...t, [b.kind]: (t[b.kind] ?? 0) + 1 }), {});
  console.log(`${c.plan.modules.length} modules, ${c.plan.concepts.length} concepts, ${c.spans.length} spans, ${c.items.length} items`);
  console.log(`timeline: ${JSON.stringify(kinds)}`);
}
console.log(`warnings (${r.progress.warnings.length}):\n- ${r.progress.warnings.slice(0, 12).join("\n- ")}`);
