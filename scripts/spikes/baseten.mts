// Spike: Muse Spark Open on Baseten. Checks the model id, json_schema support and reasoning output.
// Run: pnpm spike:baseten

const key = process.env.BASETEN_API_KEY;
if (!key) throw new Error("BASETEN_API_KEY is not set (.env.local)");
const base = process.env.BASETEN_BASE_URL ?? "https://inference.baseten.co/v1";
const model = "meta-models/muse-spark-open-1026";

const transcript = [
  "[0:00] So today we're going to look at how a prior turns into a posterior.",
  "[0:06] The prior is what you believed before you saw any evidence.",
  "[0:11] Then you see the evidence, and you ask: how likely was this evidence if my hypothesis were true?",
  "[0:18] That's the likelihood. Multiply the prior by the likelihood,",
  "[0:23] divide by how likely the evidence was overall, and you get the posterior.",
  "[0:29] Anyway, let me tell you about my weekend.",
].join("\n");

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["spans"],
  properties: {
    spans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["start", "end", "quote"],
        properties: { start: { type: "string" }, end: { type: "string" }, quote: { type: "string" } },
      },
    },
  },
};

async function call(structured: boolean) {
  const started = Date.now();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: `Objective: explain how a posterior is computed from a prior and a likelihood.\nFind the span of this transcript that teaches it. Return JSON {"spans":[{"start","end","quote"}]} with timestamps as written and a short exact quote from inside the span.\n\n${transcript}`,
        },
      ],
      ...(structured && { response_format: { type: "json_schema", json_schema: { name: "Spans", schema } } }),
    }),
  });
  return { res, ms: Date.now() - started, body: await res.json() };
}

let { res, ms, body } = await call(true);
let mode = "json_schema";
if (!res.ok) {
  console.warn(`json_schema refused (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  ({ res, ms, body } = await call(false));
  mode = "plain prompt";
}
if (!res.ok) {
  console.error(res.status, JSON.stringify(body, null, 2));
  process.exit(1);
}

const message = body.choices[0].message;
console.log(`${model} via ${mode}: ${res.status} in ${ms} ms, usage ${JSON.stringify(body.usage)}`);
console.log(`message fields: ${Object.keys(message).join(", ")}`);
console.log(message.content);
