// Runs the real planning step and prints the outline, warnings, model and cost.
// Run: pnpm try:plan ["topic"] ["goal"] [beginner|intermediate|advanced] [minutes per day]

import { planCourse } from "../src/lib/pipeline/plan";
import type { Level } from "../src/lib/types";

const [topic = "Bayes' theorem", goal = "Understand how evidence should change what I believe", level = "beginner", minutes = "20"] =
  process.argv.slice(2);

const started = Date.now();
const { plan, warnings, usage, model } = await planCourse({ topic, goal, level: level as Level, minutesPerDay: Number(minutes) });

console.log(`${model} in ${((Date.now() - started) / 1000).toFixed(1)} s · ${usage.inputTokens} in / ${usage.outputTokens} out (${usage.reasoningTokens} reasoning) · $${usage.costUsd.toFixed(4)}`);
for (const m of plan.modules) {
  console.log(`\n## ${m.index + 1}. ${m.title}`);
  for (const id of m.conceptIds) {
    const c = plan.concepts.find((x) => x.id === id)!;
    console.log(`- ${c.title} [${c.id}]${c.prerequisites.length ? ` ← ${c.prerequisites.join(", ")}` : ""}`);
    console.log(`  why: ${c.why}`);
    for (const o of c.objectives) console.log(`  • ${o.text}\n      must include: ${o.mustInclude.join("; ")}`);
    console.log(`  search: ${c.searchQueries.join(" | ")}`);
  }
}
if (warnings.length) console.log(`\nwarnings:\n- ${warnings.join("\n- ")}`);
