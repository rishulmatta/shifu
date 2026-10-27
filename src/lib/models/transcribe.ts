// Teach-back transcription (PLAN.md §7). Muse Voice Transcribe on Meta Model API goes first: its file
// endpoint takes WAV, at most 10 minutes and 32 MB; PUSH_TO_TALK treats the whole clip as one turn,
// and asking for text/plain returns just the words. Muse Spark Open, which takes audio input,
// listens through the router when there is no Meta key or the call fails.
//
// Tested 28 Oct, 20 runs of each on the same two recordings:
// - Muse Voice Transcribe always had every word and nothing else, about 4–7 s, but stutters ("the
//   the", "doesn't really doesn't really") in most runs. collapseStutters fixes those.
// - Muse Spark Open came back verbatim in 2–7 s, but about half its runs echo the last sentence
//   (trimEcho cuts that), and about one in ten says "(silence)", drops the recording, doubles a
//   sentence or adds one nobody said ("This transcript was generated automatically…"). Telling it
//   the topic made it write the topic in as if spoken.

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
  return collapseStutters(tidy((await res.text()).replace(/^unknown:/gm, "")));
}

// Never empty: Muse Spark Open once returned "" for a full recording, and an empty reply fails
// validation, so the router asks again or moves on.
const Transcript = z.object({ text: z.string().min(1) });

const LISTEN_SYSTEM = `You transcribe a learner's spoken explanation of an idea. Write exactly the words spoken, with
light punctuation. Do not correct, complete or summarise what they said: a wrong or unfinished
explanation must stay wrong or unfinished, because it is graded afterwards.`;

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
  return trimEcho(tidy(out.data.text));
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();
const wordKey = (token: string) => token.toLowerCase().replace(/[^\p{L}\p{N}%']/gu, "");

/**
 * Collapses one to four words said twice in a row ("the the", "the chance of the chance of"), then
 * tidies Muse Voice Transcribe's punctuation: doubled stops, a stray letter after the last one
 * ("test.e"), and sentences that start in lower case.
 */
export function collapseStutters(text: string): string {
  const kept: string[] = [];
  for (const token of text.split(" ")) {
    kept.push(token);
    for (let n = 4; n >= 1; n--) {
      if (kept.length < 2 * n) continue;
      const first = kept.slice(-2 * n, -n).map(wordKey).join(" ");
      if (first.trim() && first === kept.slice(-n).map(wordKey).join(" ")) {
        kept.splice(-n, n);
        break;
      }
    }
  }
  const out = kept
    .join(" ")
    .replace(/([.!?,])[.!?,]+/g, "$1")
    .replace(/([.!?])[a-z]$/, "$1")
    .replace(/([.!?] )([a-z])/g, (_, stop: string, letter: string) => stop + letter.toUpperCase());
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Trims an echo at the end: a tail that repeats the sentence or clause just before it, cut short or
 * with one word added ("…once you have the test. The base rate doesn't really matter once you have
 * the test result."). Both must start at a boundary (after . , ! ? ; or at the start), at least
 * three words must match, and five when the echo adds a word.
 */
export function trimEcho(text: string): string {
  const tokens = text.split(" ");
  const words = tokens.map(wordKey);
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
  if (!hasMuseVoice()) return sparkListens(wav);
  try {
    return await museVoice(wav);
  } catch (e) {
    if (!canRun("transcribe")) throw e;
    return sparkListens(wav);
  }
}
