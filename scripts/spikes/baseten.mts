// Spike: Muse Spark Open on Baseten. Checks the model id, json_schema support and reasoning output.
// Run: pnpm spike:baseten [reasoning_effort]   (none | minimal | low | medium | high | xhigh | max)

const key = process.env.BASETEN_API_KEY;
if (!key) throw new Error("BASETEN_API_KEY is not set (.env.local)");
const base = process.env.BASETEN_BASE_URL ?? "https://inference.baseten.co/v1";
const model = "meta-models/muse-spark-open-1026";
const effort = process.argv[2];

// Numbered caption lines: the model answers with line numbers, and code turns them into seconds,
// so it never has to decide whether an "end" timestamp is inclusive.
const transcript = [
  "L1 [0:00] So today we're going to look at how a prior turns into a posterior.",
  "L2 [0:06] The prior is what you believed before you saw any evidence.",
  "L3 [0:11] Then you see the evidence, and you ask: how likely was this evidence if my hypothesis were true?",
  "L4 [0:18] That's the likelihood. Multiply the prior by the likelihood,",
  "L5 [0:23] divide by how likely the evidence was overall, and you get the posterior.",
  "L6 [0:29] Anyway, let me tell you about my weekend.",
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
        required: ["firstLine", "lastLine", "quote"],
        properties: { firstLine: { type: "integer" }, lastLine: { type: "integer" }, quote: { type: "string" } },
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
          content: `Objective: explain how a posterior is computed from a prior and a likelihood.\nFind the span of this transcript that teaches it. Give the first and last line numbers, both included. Start where the explanation starts, including any earlier line it refers back to ("that", "this"), and stop when it ends. Add a short exact quote from inside the span.\n\n${transcript}`,
        },
      ],
      ...(structured && { response_format: { type: "json_schema", json_schema: { name: "Spans", schema } } }),
      ...(effort && { reasoning_effort: effort }),
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
const reasoning = body.usage?.completion_tokens_details?.reasoning_tokens;
console.log(`${model} via ${mode}, effort ${effort ?? "default"}: ${res.status} in ${ms} ms`);
console.log(`tokens: ${body.usage?.prompt_tokens} in, ${body.usage?.completion_tokens} out (${reasoning} reasoning)`);
console.log(`message fields: ${Object.keys(message).join(", ")}`);
console.log(message.content);
