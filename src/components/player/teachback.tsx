"use client";

// Teach it back (PLAN.md §3, §7): explain the module aloud (or type it). A student who listened
// then asks one question at the biggest gap, and the answer is graded too (PLAN.md §3, "Teaching
// that works" 3). Then each objective is marked covered, missing or misunderstood, with the exact
// clip to rewatch for anything that wasn't covered.

import { useState } from "react";
import type { FollowUp, GradedObjective, Verdict } from "@/lib/pipeline/grade";
import type { Module, Objective, Span, Video } from "@/lib/types";
import styles from "./player.module.css";
import { useRecorder } from "./use-recorder";
import { YouTubeClip } from "./youtube-clip";

const LIMIT_S = 90;
const ANSWER_LIMIT_S = 45;

interface Graded {
  transcript: string;
  results: GradedObjective[];
  encouragement: string;
  followUp?: FollowUp;
}

interface Answered {
  question: string;
  transcript: string;
  result: GradedObjective;
}

type Phase =
  | { kind: "explain" }
  | { kind: "grading" }
  | { kind: "question"; graded: Graded }
  | { kind: "answering"; graded: Graded }
  | { kind: "done"; graded: Graded; answered?: Answered };

const LABEL: Record<Verdict, string> = { covered: "Covered", missing: "Missing", misconception: "Not quite right" };

export function TeachbackView(props: {
  slug: string;
  module: Module;
  objectives: Objective[];
  /** The misconceptions behind the learner's recent wrong answers in this module. */
  misconceptions: string[];
  clipFor: (objectiveId: string) => { span: Span; video: Video } | undefined;
  onGraded: (results: GradedObjective[]) => void;
  onContinue: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "explain" });
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [rewatch, setRewatch] = useState<string | null>(null);

  const post = async (body: FormData) => {
    body.set("moduleIndex", String(props.module.index));
    const res = await fetch(`/api/courses/${props.slug}/teachback`, { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  };

  const explain = async (body: FormData) => {
    setPhase({ kind: "grading" });
    setError("");
    body.set("misconceptions", JSON.stringify(props.misconceptions.slice(-5)));
    try {
      const graded = (await post(body)) as Graded;
      props.onGraded(graded.results);
      setText("");
      setTyping(false);
      setPhase(graded.followUp ? { kind: "question", graded } : { kind: "done", graded });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase({ kind: "explain" });
    }
  };

  const answer = async (graded: Graded, body: FormData) => {
    const followUp = graded.followUp!;
    setPhase({ kind: "answering", graded });
    setError("");
    body.set("mode", "answer");
    body.set("objectiveId", followUp.objectiveId);
    body.set("question", followUp.question);
    try {
      const data = (await post(body)) as { transcript: string; result: GradedObjective };
      props.onGraded([data.result]);
      setText("");
      setTyping(false);
      setPhase({ kind: "done", graded, answered: { question: followUp.question, ...data } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase({ kind: "question", graded });
    }
  };

  const withAudio = (wav: Blob) => {
    const body = new FormData();
    body.set("audio", wav, "teachback.wav");
    return body;
  };
  const withText = () => {
    const body = new FormData();
    body.set("text", text);
    return body;
  };

  const explaining = useRecorder(LIMIT_S, { onWav: (wav) => explain(withAudio(wav)), onError: setError });
  const replying = useRecorder(ANSWER_LIMIT_S, {
    onWav: (wav) => phase.kind === "question" && answer(phase.graded, withAudio(wav)),
    onError: setError,
  });

  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Teach it back · {props.module.title}</p>
      <h2 className={styles.title}>{phase.kind === "question" || phase.kind === "answering" ? "A question from the back row" : "Explain this module in your own words"}</h2>

      {(phase.kind === "explain" || phase.kind === "grading") && (
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

      {phase.kind === "explain" && (
        <Respond
          recorder={explaining}
          limit={LIMIT_S}
          typing={typing}
          setTyping={setTyping}
          text={text}
          setText={setText}
          minWords={8}
          labels={{ record: "● Record", submit: "Check my explanation", placeholder: "Explain it in your own words…", skip: "Skip" }}
          onSubmit={() => explain(withText())}
          onSkip={props.onContinue}
        />
      )}

      {phase.kind === "grading" && <p className={styles.lead}>Listening to your explanation and checking it against the clips…</p>}

      {(phase.kind === "question" || phase.kind === "answering") && (
        <>
          <div className={styles.student}>
            <span className={styles.studentMark} aria-hidden="true">
              ?
            </span>
            <div>
              <p className={styles.muted}>A student who listened to you asks</p>
              <p className={styles.studentQuestion}>&ldquo;{phase.graded.followUp!.question}&rdquo;</p>
            </div>
          </div>
          {phase.kind === "question" ? (
            <Respond
              recorder={replying}
              limit={ANSWER_LIMIT_S}
              typing={typing}
              setTyping={setTyping}
              text={text}
              setText={setText}
              minWords={3}
              labels={{ record: "● Answer out loud", submit: "Answer", placeholder: "Answer in a sentence or two…", skip: "Skip the question" }}
              onSubmit={() => answer(phase.graded, withText())}
              onSkip={() => setPhase({ kind: "done", graded: phase.graded })}
            />
          ) : (
            <p className={styles.lead}>Listening to your answer…</p>
          )}
        </>
      )}

      {phase.kind === "done" && (
        <>
          <p className={styles.lead}>{phase.graded.encouragement}</p>
          <ul className={styles.graded}>
            {phase.answered && (
              <Verdict
                label={`The student's question · ${LABEL[phase.answered.result.verdict]}`}
                result={phase.answered.result}
                title={`“${phase.answered.question}”`}
                clip={props.clipFor(phase.answered.result.objectiveId)}
                open={rewatch === "answer"}
                onToggle={() => setRewatch(rewatch === "answer" ? null : "answer")}
              />
            )}
            {phase.graded.results.map((r) => (
              <Verdict
                key={r.objectiveId}
                label={LABEL[r.verdict]}
                result={r}
                title={props.objectives.find((o) => o.id === r.objectiveId)?.text ?? ""}
                clip={props.clipFor(r.objectiveId)}
                open={rewatch === r.objectiveId}
                onToggle={() => setRewatch(rewatch === r.objectiveId ? null : r.objectiveId)}
              />
            ))}
          </ul>
          <details className={styles.transcript}>
            <summary>What Shifu heard</summary>
            <p>{phase.graded.transcript}</p>
            {phase.answered && <p>Your answer: {phase.answered.transcript}</p>}
          </details>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={props.onContinue}>
              Continue
            </button>
            <button
              className={styles.secondary}
              onClick={() => {
                setPhase({ kind: "explain" });
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

/** Record or type a response, with a timer while recording. */
function Respond(props: {
  recorder: ReturnType<typeof useRecorder>;
  limit: number;
  typing: boolean;
  setTyping: (t: boolean) => void;
  text: string;
  setText: (t: string) => void;
  minWords: number;
  labels: { record: string; submit: string; placeholder: string; skip: string };
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const { recorder, labels } = props;
  if (recorder.recording) {
    return (
      <div className={styles.actions}>
        <button className={styles.primary} onClick={recorder.stop}>
          ■ Stop · {Math.floor(recorder.seconds)} s
        </button>
        <span className={styles.recording} aria-live="polite">
          Recording, up to {props.limit} s
        </span>
      </div>
    );
  }
  if (props.typing) {
    return (
      <form
        className={styles.typed}
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
      >
        <textarea
          className={styles.textarea}
          value={props.text}
          onChange={(e) => props.setText(e.target.value)}
          rows={props.minWords > 3 ? 6 : 3}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder.replace("…", "")}
        />
        <div className={styles.actions}>
          <button className={styles.primary} disabled={props.text.trim().split(/\s+/).length < props.minWords}>
            {labels.submit}
          </button>
          <button type="button" className={styles.secondary} onClick={() => props.setTyping(false)}>
            Record instead
          </button>
        </div>
      </form>
    );
  }
  return (
    <div className={styles.actions}>
      <button className={styles.primary} onClick={recorder.start}>
        {labels.record}
      </button>
      <button className={styles.secondary} onClick={() => props.setTyping(true)}>
        Type it instead
      </button>
      <button className={styles.secondary} onClick={props.onSkip}>
        {labels.skip}
      </button>
    </div>
  );
}

function Verdict(props: {
  label: string;
  title: string;
  result: GradedObjective;
  clip?: { span: Span; video: Video };
  open: boolean;
  onToggle: () => void;
}) {
  const { result: r, clip } = props;
  return (
    <li className={styles[`verdict_${r.verdict}`]}>
      <p className={styles.verdict}>{props.label}</p>
      <p className={styles.gradedObjective}>{props.title}</p>
      <p>{r.note}</p>
      {r.heard && <p className={styles.heard}>You said: “{r.heard}”</p>}
      {r.verdict !== "covered" && clip && (
        <>
          <button className={styles.link} onClick={props.onToggle}>
            {props.open ? "Hide the clip" : "Rewatch the moment that explains it"}
          </button>
          {props.open && <YouTubeClip videoId={clip.video.id} start={clip.span.start} end={clip.span.end} />}
        </>
      )}
    </li>
  );
}
