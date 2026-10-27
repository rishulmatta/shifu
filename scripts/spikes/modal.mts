// Spike: Muse Spark Open on a Modal Shared Endpoint. Lists the served model names, then checks
// json_schema output with reasoning_effort, then audio input on a WAV (macOS `say` makes one).
// Run: pnpm spike:modal [path.wav]

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.MODAL_BASE_URL;
const id = process.env.MODAL_PROXY_TOKEN_ID;
const secret = process.env.MODAL_PROXY_TOKEN_SECRET;
if (!base || !id || !secret) {
  throw new Error("MODAL_BASE_URL, MODAL_PROXY_TOKEN_ID and MODAL_PROXY_TOKEN_SECRET must be set (.env.local)");
}
const headers = { Authorization: `Bearer ${id}.${secret}`, "Content-Type": "application/json" };

const models = await fetch(`${base}/models`, { headers });
console.log(`models: ${models.status}`, models.ok ? (await models.json()).data?.map((m: { id: string }) => m.id) : "");

async function ask(label: string, body: object) {
  const started = Date.now();
  const res = await fetch(`${base}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  console.log(`\n${label}: ${res.status} in ${Date.now() - started} ms`);
  try {
    const json = JSON.parse(text);
    console.log(json.choices?.[0]?.message?.content ?? text.slice(0, 400));
    console.log("usage", JSON.stringify(json.usage));
  } catch {
    console.log(text.slice(0, 400));
  }
}

const model = process.env.MODAL_MODEL ?? "meta-models/Muse-Spark-Open-816B-A42B";
const schema = {
  type: "object",
  properties: { answer: { type: "string" }, confidence: { type: "number" } },
  required: ["answer", "confidence"],
  additionalProperties: false,
};
await ask("json_schema + reasoning_effort low", {
  model,
  reasoning_effort: "low",
  messages: [{ role: "user", content: "A test is 99% sensitive and 1% of people have the condition. Is a positive result proof? One sentence." }],
  response_format: { type: "json_schema", json_schema: { name: "Answer", schema, strict: true } },
});

let path = process.argv[2];
if (!path) {
  path = join(tmpdir(), "shifu-modal-spike.wav");
  execFileSync("say", ["-o", path, "--file-format=WAVE", "--data-format=LEI16@16000", "The prior is what you believe before the evidence arrives."]);
}
await ask("audio input", {
  model,
  reasoning_effort: "low",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Transcribe this recording verbatim. Output only the words spoken." },
        { type: "input_audio", input_audio: { data: readFileSync(path).toString("base64"), format: "wav" } },
      ],
    },
  ],
});
