// Spike: Muse Voice Transcribe on a WAV file (the file endpoint takes WAV, at most 10 min / 32 MB).
// Run: pnpm spike:voice [path.wav] [PUSH_TO_TALK|ENDPOINTING]
// Without a path, macOS `say` synthesises a 16 kHz mono WAV to test with.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const key = process.env.META_MODEL_API_KEY;
if (!key) throw new Error("META_MODEL_API_KEY is not set (.env.local)");
const mode = process.argv[3] ?? "PUSH_TO_TALK";

let path = process.argv[2];
if (!path) {
  path = join(tmpdir(), "shifu-voice-spike.wav");
  const text =
    "Bayes' theorem updates a belief. You start with a prior, multiply it by how likely the evidence is under the hypothesis, and divide by how likely the evidence is overall. That gives the posterior.";
  execFileSync("say", ["-o", path, "--file-format=WAVE", "--data-format=LEI16@16000", text]);
}

const form = new FormData();
form.append(
  "request",
  new Blob([JSON.stringify({ model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", mode })], { type: "application/json" }),
);
form.append("audio", new Blob([readFileSync(path)], { type: "audio/wav" }), "clip.wav");

const started = Date.now();
const res = await fetch("https://api.meta.ai/v1/asr/transcribe", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  body: form,
});
console.log(`${mode}: ${res.status} in ${Date.now() - started} ms`);
console.log(JSON.stringify(await res.json(), null, 2));
