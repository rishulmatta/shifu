// Spike: Muse Spark structured output on Meta Model API (chat completions + json_schema).
// Run: pnpm spike:plan ["topic"] [model]

const key = process.env.META_MODEL_API_KEY;
if (!key) throw new Error("META_MODEL_API_KEY is not set (.env.local)");
const topic = process.argv[2] ?? "Bayes' theorem";
const model = process.argv[3] ?? "muse-spark-1.3";

const strings = { type: "array", items: { type: "string" } };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const schema = obj({
  modules: {
    type: "array",
    items: obj({
      title: { type: "string" },
      concepts: {
        type: "array",
        items: obj({
          id: { type: "string" },
          title: { type: "string" },
          prerequisites: strings,
          objectives: { type: "array", items: obj({ text: { type: "string" }, mustInclude: strings }) },
          searchQueries: strings,
        }),
      },
    }),
  },
});

const started = Date.now();
const res = await fetch("https://api.meta.ai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content:
          "You design short video courses. Split the topic into 2-3 modules of 2-4 concepts. Concept ids are kebab-case; prerequisites list earlier concept ids. Each concept has 1-3 objectives phrased as something the learner can do, each with 2-4 points a good explanation must include, and 2-3 YouTube search queries.",
      },
      { role: "user", content: `Topic: ${topic}\nLearner: curious adult, no background. Time: 45 minutes in total.` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "CoursePlan", strict: true, schema } },
  }),
});
const ms = Date.now() - started;
const body = await res.json();
if (!res.ok) {
  console.error(res.status, JSON.stringify(body, null, 2));
  process.exit(1);
}

const plan = JSON.parse(body.choices[0].message.content);
console.log(`${model}: ${res.status} in ${ms} ms, usage ${JSON.stringify(body.usage)}`);
for (const m of plan.modules) {
  console.log(`\n# ${m.title}`);
  for (const c of m.concepts) {
    console.log(`- ${c.id} (after: ${c.prerequisites.join(", ") || "none"})`);
    for (const o of c.objectives) console.log(`    • ${o.text}  [${o.mustInclude.length} must-include]`);
    console.log(`    search: ${c.searchQueries.join(" | ")}`);
  }
}
