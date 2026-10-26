// Turns a browser recording into the 16 kHz mono 16-bit WAV that Muse Voice Transcribe accepts.

export const WAV_RATE = 16_000;

/** PCM samples in [-1, 1] → a WAV file (16-bit little-endian, mono). */
export function encodeWav(samples: Float32Array, sampleRate = WAV_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return new Blob([buffer], { type: "audio/wav" });
}

/** Any recording the browser can decode (webm, mp4, ogg) → 16 kHz mono WAV. Browser only. */
export async function recordingToWav(recording: Blob): Promise<Blob> {
  const decoded = await new AudioContext().decodeAudioData(await recording.arrayBuffer());
  const length = Math.ceil(decoded.duration * WAV_RATE);
  const offline = new OfflineAudioContext(1, length, WAV_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), WAV_RATE);
}
