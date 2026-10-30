// Builds one course end to end on the live sources and model providers and saves it in the app's
// store: Postgres when DATABASE_URL is set, .data/ otherwise. For seeding the courses the home
// page lists, outside the visitor limits of the create form.
//
//   pnpm seed "<topic>" --goal "<goal>" [--level beginner|intermediate|advanced] [--minutes 20] [--slug <slug>]

import { buildCourse, cached, newRecord } from "../src/lib/pipeline/build";
import { liveSources, missingForBuilds } from "../src/lib/sources";
import { getStore } from "../src/lib/store";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const topic = args.find((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1].startsWith("--")));
if (!topic) {
  console.error('usage: pnpm seed "<topic>" --goal "<goal>" [--level beginner] [--minutes 20] [--slug <slug>]');
  process.exit(1);
}
const missing = missingForBuilds();
if (missing.length) {
  console.error(`Shifu still needs ${missing.join(", ")} (set them in .env.local).`);
  process.exit(1);
}

const level = (opt("level") ?? "beginner") as "beginner" | "intermediate" | "advanced";
const input = { topic, goal: opt("goal") ?? `Understand ${topic}`, level, minutesPerDay: Number(opt("minutes") ?? 20) };
const slug =
  opt("slug") ??
  topic
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const store = getStore();
if (await store.getCourse(slug)) {
  console.error(`A course with slug "${slug}" exists already; pass --slug to pick another.`);
  process.exit(1);
}
await store.createCourse(newRecord(slug, input));
console.log(`Building /c/${slug} in ${process.env.DATABASE_URL ? "Postgres" : ".data/"} · ${input.topic} · ${input.goal} · ${level}, ${input.minutesPerDay} min/day`);

const started = Date.now();
let last = "";
const timer = setInterval(async () => {
  const r = await store.getCourse(slug);
  if (!r) return;
  const line = `${r.progress.step}: ${r.progress.message} (${r.progress.modulesReady}/${r.progress.modulesTotal})`;
  if (line !== last) console.log(`  [${((Date.now() - started) / 1000).toFixed(0)} s] ${line}`);
  last = line;
}, 2000);
await buildCourse(slug, input, cached(liveSources, store), store);
clearInterval(timer);

const r = (await store.getCourse(slug))!;
const c = r.course;
console.log(`\n${r.progress.step} in ${((Date.now() - started) / 1000).toFixed(1)} s · $${r.progress.costUsd.toFixed(4)} · ${r.progress.message}`);
if (c) {
  const kinds = c.timeline.reduce<Record<string, number>>((t, b) => ({ ...t, [b.kind]: (t[b.kind] ?? 0) + 1 }), {});
  console.log(`${c.plan.modules.length} modules, ${c.plan.concepts.length} concepts, ${Object.keys(c.videos).length} videos, ${c.spans.length} spans, ${c.items.length} items`);
  console.log(`timeline: ${JSON.stringify(kinds)}`);
  for (const m of c.plan.modules) console.log(`- ${m.title}: ${m.conceptIds.join(", ")}`);
  for (const v of Object.values(c.videos)) console.log(`  · ${v.channel} — ${v.title}`);
}
if (r.progress.warnings.length) console.log(`warnings (${r.progress.warnings.length}):\n- ${r.progress.warnings.slice(0, 20).join("\n- ")}`);
process.exit(r.progress.step === "ready" ? 0 : 2);
