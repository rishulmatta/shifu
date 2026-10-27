// Teach-back transcription (PLAN.md §7). Muse Voice Transcribe on Meta Model API goes first when its
// key is set: the file endpoint takes WAV, at most 10 minutes and 32 MB; PUSH_TO_TALK treats the
// whole clip as one turn, and asking for text/plain returns just the words, one turn per line.
// Otherwise, or if it fails, Muse Spark Open listens to the WAV itself through the router (tested
// 28 Oct on Baseten: a 30-second explanation comes back verbatim in about 7 s for $0.002, wrong
// claims kept as said, but about two runs in five echo the last sentence, whole or cut short, so
// that echo is trimmed. Telling it the topic made it worse: it wrote the topic in as if spoken).

import { z } from "zod";
import { canRun, generate } from "./router";

export const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
const MAX_BYTES = 32 * 1024 * 1024;

const hasMuseVoice = () => Boolean(process.env.META_MODEL_API_KEY);

export const canTranscribe = () => hasMuseVoice() || canRun("transcribe");

async function museVoice(wav: Blob): Promise<string> {
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify({ model: TRANSCRIBE_MODEL, audioEncoding: "WAV", mode: "PUSH_TO_TALK" })], { type: "application/json" }));
  form.append("audio", wav, "teachback.wav");
  const res = await fetch("https://api.meta.ai/v1/asr/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.META_MODEL_API_KEY}`, Accept: "text/plain" },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
  return (await res.text()).replace(/^unknown:/gm, "");
}

const Transcript = z.object({ text: z.string() });

const LISTEN_SYSTEM = `You transcribe a learner's spoken explanation of an idea. Write exactly the words spoken, with
light punctuation. Do not correct, complete or summarise what they said: a wrong or unfinished
explanation must stay wrong or unfinished, because it is graded afterwards. If nothing is said,
return an empty string.`;

async function sparkListens(wav: Blob): Promise<string> {
  const data = Buffer.from(await wav.arrayBuffer()).toString("base64");
  const out = await generate("transcribe", {
    name: "Transcript",
    schema: Transcript,
    system: LISTEN_SYSTEM,
    user: "Transcribe this recording.",
    audio: { data, format: "wav" },
    timeoutMs: 60_000,
  });
  return out.data.text;
}

/**
 * Trims an echo at the end: a tail that repeats the sentence or clause just before it, cut short or
 * with one word added ("…once you have the test. The base rate doesn't really matter once you have
 * the test result."). Both must start at a boundary (after . , ! ? ; or at the start), at least
 * three words must match, and five when the echo adds a word.
 */
export function trimEcho(text: string): string {
  const tokens = text.split(" ");
  const words = tokens.map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
  const boundary = (i: number) => i === 0 || /[.,!?;]$/.test(tokens[i - 1]);
  const n = words.length;
  for (let start = Math.ceil(n / 3); start <= n - 3; start++) {
    if (!boundary(start)) continue;
    const tail = n - start;
    for (let unit = Math.max(3, tail - 1); unit <= start; unit++) {
      const same = Math.min(tail, unit);
      if ((tail > unit && unit < 5) || !boundary(start - unit)) continue;
      if (words.slice(start - unit, start - unit + same).join(" ") === words.slice(start, start + same).join(" ")) {
        return tokens.slice(0, start).join(" ").replace(/,$/, ".");
      }
    }
  }
  return text;
}

export async function transcribeWav(wav: Blob): Promise<string> {
  if (!canTranscribe()) throw new Error("Voice transcription needs a Meta, Baseten or Modal key");
  if (wav.size > MAX_BYTES) throw new Error("The recording is too large");
  let text: string;
  if (hasMuseVoice()) {
    try {
      text = await museVoice(wav);
    } catch (e) {
      if (!canRun("transcribe")) throw e;
      text = await sparkListens(wav);
    }
  } else {
    text = await sparkListens(wav);
  }
  return trimEcho(text.replace(/\s+/g, " ").trim());
}
