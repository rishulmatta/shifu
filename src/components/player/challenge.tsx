"use client";

// The goal challenge (PLAN.md §3, "Teaching that works" 1): the learner's goal as a few scenario
// questions. Before module 1 they're taken cold, with "I don't know yet" and nothing given away.
// At the end they're taken again with feedback, the misconception behind each wrong pick and a
// way back to each objective involved, closing on "Before: 1 of 4. Now: 4 of 4."

import { useState } from "react";
import type { Challenge, CheckItem, Concept, Confidence } from "@/lib/types";
import { Flecks, Seal } from "../mark";
import { Question } from "./blocks";
import { OptionInk, trackInk } from "./ink";
import styles from "./player.module.css";

type Answers = (number | null)[];

const score = (challenges: Challenge[], answers?: Answers) =>
  answers ? challenges.filter((c, i) => answers[i] === c.answerIndex).length : undefined;

/** A challenge in the shape the question component takes. */
const asItem = (c: Challenge): CheckItem => ({ ...c, kind: "mcq", objectiveId: c.objectiveIds[0], evidence: { spanId: "", quote: "" } });

export function ChallengeView(props: {
  stage: "before" | "after";
  goal: string;
  challenges: Challenge[];
  answers: { before?: Answers; after?: Answers };
  conceptOf: (objectiveId: string) => Concept | undefined;
  onAnswer: (index: number, choice: number | null, confidence?: Confidence) => void;
  onRewatch: (conceptId: string) => void;
  onContinue: () => void;
}) {
  const { challenges, stage } = props;
  const mine = props.answers[stage];
  const done = !!mine && mine.length >= challenges.length && mine.every((a) => a !== undefined);
  const [index, setIndex] = useState<number | null>(done ? challenges.length : null);
  const n = challenges.length;

  if (index === null) {
    return (
      <section className={styles.card}>
        <p className={styles.eyebrow}>Goal challenge</p>
        <h2 className={styles.title}>{stage === "before" ? "Before you start: your goal, as questions" : "Your goal, again"}</h2>
        <p className={styles.lead}>&ldquo;{props.goal}&rdquo;</p>
        <p className={styles.muted}>
          {stage === "before"
            ? `${n} questions that need what this course teaches. Answer what you can and pick "I don't know yet" for the rest; you'll see how you did after the course, when you take them again.`
            : `The same ${n} questions you took before the course. This time you'll see how you did, and what to rewatch.`}
        </p>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={() => setIndex(0)}>
            Start
          </button>
          {stage === "before" && (
            <button className={styles.secondary} onClick={props.onContinue}>
              Skip for now
            </button>
          )}
        </div>
      </section>
    );
  }

  if (index >= n) return stage === "before" ? <Saved n={n} answers={mine ?? []} onContinue={props.onContinue} /> : <Result {...props} />;

  const c = challenges[index];
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>
        Goal challenge · {index + 1} of {n}
      </p>
      {stage === "before" ? (
        <Cold key={c.id} challenge={c} onAnswer={(choice) => props.onAnswer(index, choice)} onNext={() => setIndex(index + 1)} last={index + 1 === n} />
      ) : (
        <Warm
          key={c.id}
          challenge={c}
          conceptOf={props.conceptOf}
          onAnswer={(choice, confidence) => props.onAnswer(index, choice, confidence)}
          onRewatch={props.onRewatch}
          onNext={() => setIndex(index + 1)}
          last={index + 1 === n}
        />
      )}
    </section>
  );
}

/** Before the course: pick an answer or "I don't know yet"; nothing is revealed. */
function Cold(props: { challenge: Challenge; last: boolean; onAnswer: (choice: number | null) => void; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null | undefined>();
  return (
    <>
      <h2 className={styles.title}>{props.challenge.prompt}</h2>
      <div className={styles.options}>
        {props.challenge.options.map((o, i) => (
          <button
            key={i}
            className={`${styles.option} ${picked === i ? styles.picked : ""}`}
            aria-pressed={picked === i}
            onPointerMove={trackInk}
            onClick={() => setPicked(i)}
          >
            <OptionInk />
            <span className={styles.optionText}>{o}</span>
          </button>
        ))}
        <button
          className={`${styles.option} ${styles.unsure} ${picked === null ? styles.picked : ""}`}
          aria-pressed={picked === null}
          onPointerMove={trackInk}
          onClick={() => setPicked(null)}
        >
          <OptionInk />
          <span className={styles.optionText}>I don&apos;t know yet</span>
        </button>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.primary}
          disabled={picked === undefined}
          onClick={() => {
            props.onAnswer(picked ?? null);
            props.onNext();
          }}
        >
          {props.last ? "Done" : "Next question"}
        </button>
      </div>
    </>
  );
}

/** After the course: the full question, with what went wrong and where to look again. */
function Warm(props: {
  challenge: Challenge;
  last: boolean;
  conceptOf: (objectiveId: string) => Concept | undefined;
  onAnswer: (choice: number, confidence: Confidence) => void;
  onRewatch: (conceptId: string) => void;
  onNext: () => void;
}) {
  const [answered, setAnswered] = useState(false);
  const concepts = [...new Map(props.challenge.objectiveIds.flatMap((id) => props.conceptOf(id) ?? []).map((c) => [c.id, c])).values()];
  return (
    <>
      <Question
        item={asItem(props.challenge)}
        onAnswer={(choice, confidence) => {
          props.onAnswer(choice, confidence);
          setAnswered(true);
        }}
      />
      {answered && (
        <>
          {concepts.length > 0 && (
            <p className={styles.rewatch}>
              Draws on{" "}
              {concepts.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && (i === concepts.length - 1 ? " and " : ", ")}
                  <button className={styles.link} onClick={() => props.onRewatch(c.id)}>
                    {c.title}
                  </button>
                </span>
              ))}
              .
            </p>
          )}
          <div className={styles.actions}>
            <button className={styles.primary} onClick={props.onNext}>
              {props.last ? "See how far you've come" : "Next question"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Saved({ n, answers, onContinue }: { n: number; answers: Answers; onContinue: () => void }) {
  const tried = answers.filter((a) => a !== null && a !== undefined).length;
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Goal challenge</p>
      <h2 className={styles.title}>Saved for the end</h2>
      <p className={styles.lead}>
        {tried === n ? `You answered all ${n}.` : tried === 0 ? `All ${n} are for later.` : `You answered ${tried} of ${n}; the rest are for later.`} You&apos;ll take
        them again after the course and see how far you&apos;ve come.
      </p>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={onContinue}>
          Start the course
        </button>
      </div>
    </section>
  );
}

/** Before and now, side by side: the headline of the course. */
function Result(props: Parameters<typeof ChallengeView>[0]) {
  const { challenges } = props;
  const before = score(challenges, props.answers.before);
  const now = score(challenges, props.answers.after) ?? 0;
  const n = challenges.length;
  // The dots fill left to right, 80 ms apart, the "Now" row after the "Before" row.
  const row = (answers: Answers | undefined, from: number) =>
    challenges.map((c, i) => (
      <span
        key={c.id}
        className={answers?.[i] === c.answerIndex ? styles.scoreRight : styles.scoreMiss}
        title={c.prompt}
        style={{ animationDelay: `${from + i * 80}ms` }}
      />
    ));
  const nowFrom = before !== undefined ? 360 + n * 80 + 200 : 360;
  const missed = challenges.filter((c, i) => props.answers.after?.[i] !== c.answerIndex);
  const behind = [...new Map(missed.flatMap((c) => c.objectiveIds.flatMap((id) => props.conceptOf(id) ?? [])).map((c) => [c.id, c])).values()];
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Goal challenge</p>
      {now === n && n > 0 && (
        <>
          <Seal size={56} stamp label="Every one right" className={styles.seal} />
          <Flecks count={14} delay={220} className={styles.sealFlecks} />
        </>
      )}
      <h2 className={styles.result}>
        {before !== undefined && (
          <span className={styles.resultBefore}>
            Before: {before} of {n}.{" "}
          </span>
        )}
        <span className={styles.resultNow}>
          Now: {now} of {n}.
        </span>
      </h2>
      <div className={styles.scoreRows} role="img" aria-label={`${before !== undefined ? `Before ${before} of ${n}, ` : ""}now ${now} of ${n}`}>
        {before !== undefined && (
          <>
            <span className={styles.scoreLabel}>Before</span>
            <span className={styles.scoreDots}>{row(props.answers.before, 360)}</span>
          </>
        )}
        <span className={styles.scoreLabel}>Now</span>
        <span className={styles.scoreDots}>{row(props.answers.after, nowFrom)}</span>
      </div>
      <p className={styles.lead}>&ldquo;{props.goal}&rdquo;</p>
      {missed.length > 0 ? (
        <p className={styles.rewatch}>
          {missed.length === 1 ? "One still trips you up. " : `${missed.length} still trip you up. `}
          Go back to{" "}
          {behind.map((c, i) => (
            <span key={c.id}>
              {i > 0 && (i === behind.length - 1 ? " or " : ", ")}
              <button className={styles.link} onClick={() => props.onRewatch(c.id)}>
                {c.title}
              </button>
            </span>
          ))}
          .
        </p>
      ) : (
        <p className={styles.muted}>Every one of them, right. That&apos;s what you came for.</p>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} onClick={props.onContinue}>
          Continue
        </button>
      </div>
    </section>
  );
}
