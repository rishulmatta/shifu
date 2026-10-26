"use client";

// Teach it back (PLAN.md §3, §7): explain the module aloud (or type it), get each objective marked
// covered, missing or misunderstood, and rewatch the exact clip for anything that wasn't covered.

import { useEffect, useRef, useState } from "react";
import type { GradedObjective, Verdict } from "@/lib/pipeline/grade";
import type { Module, Objective, Span, Video } from "@/lib/types";
import { recordingToWav } from "@/lib/wav";
import styles from "./player.module.css";
import { YouTubeClip } from "./youtube-clip";

const LIMIT_S = 90;

type Phase = { kind: "idle" } | { kind: "recording"; started: number } | { kind: "grading" } | { kind: "done"; transcript: string; results: GradedObjective[]; encouragement: string };

const LABEL: Record<Verdict, string> = { covered: "Covered", missing: "Missing", misconception: "Not quite right" };

export function TeachbackView(props: {
  slug: string;
  module: Module;
  objectives: Objective[];
  clipFor: (objectiveId: string) => { span: Span; video: Video } | undefined;
  onGraded: (results: GradedObjective[]) => void;
  onContinue: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [rewatch, setRewatch] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);

  const submit = async (body: FormData) => {
    setPhase({ kind: "grading" });
    setError("");
    body.set("moduleIndex", String(props.module.index));
    try {
      const res = await fetch(`/api/courses/${props.slug}/teachback`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setPhase({ kind: "done", ...data });
      props.onGraded(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase({ kind: "idle" });
    }
  };

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const wav = await recordingToWav(new Blob(chunks, { type: r.mimeType }));
          const body = new FormData();
          body.set("audio", wav, "teachback.wav");
          await submit(body);
        } catch {
          setError("We couldn't read that recording. Try again, or type it instead.");
          setPhase({ kind: "idle" });
        }
      };
      recorder.current = r;
      r.start();
      setPhase({ kind: "recording", started: Date.now() });
    } catch {
      setError("Shifu needs your microphone for this. You can also type it instead.");
    }
  };

  const stop = () => recorder.current?.state === "recording" && recorder.current.stop();

  // Tick the timer while recording and stop at the limit.
  useEffect(() => {
    if (phase.kind !== "recording") return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - phase.started) / 1000;
      setNow(elapsed);
      if (elapsed >= LIMIT_S && recorder.current?.state === "recording") recorder.current.stop();
    }, 250);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Teach it back · {props.module.title}</p>
      <h2 className={styles.title}>Explain this module in your own words</h2>

      {phase.kind !== "done" && (
        <>
          <p className={styles.lead}>Up to {LIMIT_S} seconds, out loud, as if to a friend. Try to cover:</p>
          <ul className={styles.objectives}>
            {props.objectives.map((o) => (
              <li key={o.id}>{o.text}</li>
            ))}
          </ul>
        </>
      )}

      {error && (
        <p className={styles.note} role="alert">
          {error}
        </p>
      )}

      {phase.kind === "idle" && !typing && (
        <div className={styles.actions}>
          <button className={styles.primary} onClick={start}>
            ● Record
          </button>
          <button className={styles.secondary} onClick={() => setTyping(true)}>
            Type it instead
          </button>
          <button className={styles.secondary} onClick={props.onContinue}>
            Skip
          </button>
        </div>
      )}

      {phase.kind === "idle" && typing && (
        <form
          className={styles.typed}
          onSubmit={(e) => {
            e.preventDefault();
            const body = new FormData();
            body.set("text", text);
            submit(body);
          }}
        >
          <textarea className={styles.textarea} value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Explain it in your own words…" aria-label="Your explanation" />
          <div className={styles.actions}>
            <button className={styles.primary} disabled={text.trim().split(/\s+/).length < 8}>
              Check my explanation
            </button>
            <button type="button" className={styles.secondary} onClick={() => setTyping(false)}>
              Record instead
            </button>
          </div>
        </form>
      )}

      {phase.kind === "recording" && (
        <div className={styles.actions}>
          <button className={styles.primary} onClick={stop}>
            ■ Stop · {Math.floor(now)} s
          </button>
          <span className={styles.recording} aria-live="polite">
            Recording, up to {LIMIT_S} s
          </span>
        </div>
      )}

      {phase.kind === "grading" && <p className={styles.lead}>Listening to your explanation and checking it against the clips…</p>}

      {phase.kind === "done" && (
        <>
          <p className={styles.lead}>{phase.encouragement}</p>
          <ul className={styles.graded}>
            {phase.results.map((r) => {
              const objective = props.objectives.find((o) => o.id === r.objectiveId);
              const clip = props.clipFor(r.objectiveId);
              return (
                <li key={r.objectiveId} className={styles[`verdict_${r.verdict}`]}>
                  <p className={styles.verdict}>{LABEL[r.verdict]}</p>
                  <p className={styles.gradedObjective}>{objective?.text}</p>
                  <p>{r.note}</p>
                  {r.heard && <p className={styles.heard}>You said: “{r.heard}”</p>}
                  {r.verdict !== "covered" && clip && (
                    <>
                      <button className={styles.link} onClick={() => setRewatch(rewatch === r.objectiveId ? null : r.objectiveId)}>
                        {rewatch === r.objectiveId ? "Hide the clip" : "Rewatch the moment that explains it"}
                      </button>
                      {rewatch === r.objectiveId && <YouTubeClip videoId={clip.video.id} start={clip.span.start} end={clip.span.end} />}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <details className={styles.transcript}>
            <summary>What Shifu heard</summary>
            <p>{phase.transcript}</p>
          </details>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={props.onContinue}>
              Continue
            </button>
            <button
              className={styles.secondary}
              onClick={() => {
                setPhase({ kind: "idle" });
                setRewatch(null);
              }}
            >
              Try again
            </button>
          </div>
        </>
      )}
    </section>
  );
}
