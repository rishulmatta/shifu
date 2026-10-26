// Muse Voice Transcribe on Meta Model API (PLAN.md §7, teach-back). The file endpoint takes WAV,
// at most 10 minutes and 32 MB; PUSH_TO_TALK treats the whole clip as one turn. Asking for
// text/plain returns just the words, one turn per line.

export const canTranscribe = () => Boolean(process.env.META_MODEL_API_KEY);

export const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
const MAX_BYTES = 32 * 1024 * 1024;

export async function transcribeWav(wav: Blob): Promise<string> {
  if (!canTranscribe()) throw new Error("Voice transcription needs META_MODEL_API_KEY");
  if (wav.size > MAX_BYTES) throw new Error("The recording is too large");
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
  return (await res.text()).replace(/^unknown:/gm, "").replace(/\s+/g, " ").trim();
}
