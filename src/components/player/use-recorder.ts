"use client";

// Records from the microphone up to a limit and hands back 16 kHz WAV (src/lib/wav.ts), for the
// teach-back's explanation and for the answer to the student's question.

import { useEffect, useRef, useState } from "react";
import { recordingToWav } from "@/lib/wav";

export function useRecorder(limitS: number, handlers: { onWav: (wav: Blob) => void; onError: (message: string) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  // The handlers of the latest render, for a recording that stops after the render that started it.
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setStartedAt(null);
        try {
          latest.current.onWav(await recordingToWav(new Blob(chunks, { type: r.mimeType })));
        } catch {
          latest.current.onError("We couldn't read that recording. Try again, or type it instead.");
        }
      };
      recorder.current = r;
      r.start();
      setSeconds(0);
      setStartedAt(Date.now());
    } catch {
      latest.current.onError("Shifu needs your microphone for this. You can also type it instead.");
    }
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  // Tick the timer while recording and stop at the limit.
  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setSeconds(elapsed);
      if (elapsed >= limitS && recorder.current?.state === "recording") recorder.current.stop();
    }, 250);
    return () => clearInterval(t);
  }, [startedAt, limitS]);

  return { recording: startedAt !== null, seconds, start, stop };
}
