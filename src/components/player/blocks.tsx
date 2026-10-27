"use client";

// One view per timeline block (PLAN.md §3). Each view gets what it needs and reports back through
// callbacks; the player owns progress and position.

import { useState } from "react";
import type { Rating } from "@/lib/learner";
import { clock } from "@/lib/course-view";
import type { CardItem, CheckItem, Concept, Confidence, Module, Objective, Span, Video } from "@/lib/types";
import { CoachControls } from "../coach/coach-controls";
import styles from "./player.module.css";
import { YouTubeClip } from "./youtube-clip";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

function Credit({ video, span }: { video: Video; span: Span }) {
  return (
    <p className={styles.credit}>
      <a href={`https://www.youtube.com/watch?v=${video.id}&t=${Math.floor(span.start)}s`} target="_blank" rel="noreferrer">
        {video.channel} · {video.title}
      </a>{" "}
      <span className={styles.muted}>
        {clock(span.start)}–{clock(span.end)}
      </span>
    </p>
  );
}

// ── Intro ────────────────────────────────────────────────────────────────────────────────────

export function IntroView(props: {
  concept: Concept;
  module: Module;
  moduleCount: number;
  buildsOn: Concept[];
  unfinished: Concept[];
  onStart: () => void;
  onGoTo: (conceptId: string) => void;
}) {
  const { concept, module, moduleCount, buildsOn, unfinished } = props;
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>
        Module {module.index + 1} of {moduleCount} · {module.title}
      </p>
      <h2 className={styles.title}>{concept.title}</h2>
      <p className={styles.lead}>{concept.why}</p>
      {buildsOn.length > 0 && <p className={styles.muted}>Builds on {buildsOn.map((c) => c.title).join(", ")}.</p>}
      <ul className={styles.objectives}>
        {concept.objectives.map((o) => (
          <li key={o.id}>{o.text}</li>
        ))}
      </ul>
      {unfinished.length > 0 && (
        <div className={styles.note}>
          This builds on <strong>{unfinished.map((c) => c.title).join(", ")}</strong>, which you haven&apos;t finished.{" "}
          <button className={styles.link} onClick={() => props.onGoTo(unfinished[0].id)}>
            Go there first
          </button>
        </div>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} onClick={props.onStart}>
          Start
        </button>
      </div>
    </section>
  );
}

// ── Clip ─────────────────────────────────────────────────────────────────────────────────────

export function ClipView(props: { objective: Objective; span: Span; video: Video; onEnded: () => void; onContinue: () => void }) {
  const { objective, span, video } = props;
  const [ended, setEnded] = useState(false);
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Watch</p>
      <h2 className={styles.title}>{objective.text}</h2>
      <YouTubeClip
        videoId={video.id}
        start={span.start}
        end={span.end}
        onEnded={() => {
          setEnded(true);
          props.onEnded();
        }}
      />
      <Credit video={video} span={span} />
      <div className={styles.actions}>
        <button className={ended ? styles.primary : styles.secondary} onClick={props.onContinue}>
          {ended ? "Check yourself" : "Skip to the question"}
        </button>
      </div>
      <CoachControls objectiveId={objective.id} controls={["basics", "skip"]} />
    </section>
  );
}

// ── Multiple choice, shared by checks and quizzes ────────────────────────────────────────────

const CONFIDENCE: { value: Confidence; label: string }[] = [
  { value: "guess", label: "Guessing" },
  { value: "think", label: "Think so" },
  { value: "sure", label: "Sure" },
];

/**
 * Pick an option, then say how sure you are to lock it in (PLAN.md §3, "Teaching that works").
 * A wrong pick shows the misconception behind it; a confident miss and a lucky guess are named.
 */
function Question(props: { item: CheckItem; reveal?: boolean; onAnswer: (choice: number, confidence: Confidence) => void }) {
  const { item } = props;
  const [picked, setPicked] = useState<number | null>(props.reveal ? item.answerIndex : null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const done = !!props.reveal || confidence !== null;
  const correct = picked === item.answerIndex;
  const diagnosis = done && !correct && picked !== null ? item.whyWrong?.[picked] : undefined;

  return (
    <>
      <h2 className={styles.title}>{item.prompt}</h2>
      <div className={styles.options}>
        {item.options.map((option, i) => (
          <button
            key={i}
            disabled={done}
            aria-pressed={done ? undefined : picked === i}
            className={cx(
              styles.option,
              !done && picked === i && styles.picked,
              done && i === item.answerIndex && styles.right,
              done && i === picked && !correct && styles.wrong,
            )}
            onClick={() => setPicked(i)}
          >
            {option}
          </button>
        ))}
      </div>
      {!done && picked !== null && (
        <div className={styles.confidence}>
          <span className={styles.muted}>How sure are you?</span>
          {CONFIDENCE.map((c) => (
            <button
              key={c.value}
              className={styles.secondary}
              onClick={() => {
                setConfidence(c.value);
                props.onAnswer(picked, c.value);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {diagnosis && (
        <p className={styles.diagnosis}>
          <strong>Not quite.</strong> {diagnosis}
        </p>
      )}
      {done && !correct && confidence === "sure" && (
        <p className={styles.note}>
          You were sure about this one. Confident mistakes are the easiest to fix once you see them, so it comes back first in your review.
        </p>
      )}
      {done && correct && confidence === "guess" && (
        <p className={styles.muted}>Right, though you were guessing. It will come back to make sure it stuck.</p>
      )}
      {done && <p className={styles.explanation}>{item.explanation}</p>}
    </>
  );
}

// ── Check, with "explain it differently" ─────────────────────────────────────────────────────

type CheckPhase = "ask" | "right" | "wrong" | "reexplain" | "again" | "again-right" | "again-wrong";

export function CheckView(props: {
  item: CheckItem;
  /** A different creator's span and a second question, when the course has them. */
  alternate?: { span: Span; video: Video; item: CheckItem };
  answered: boolean;
  onAnswer: (item: CheckItem, choice: number, confidence: Confidence, unaided: boolean) => void;
  onContinue: () => void;
}) {
  const { item, alternate } = props;
  // Decided once: answering marks the block answered, which must not cut this attempt short.
  const [revisit] = useState(props.answered);
  const [phase, setPhase] = useState<CheckPhase>("ask");
  const [sure, setSure] = useState(false);

  if (revisit) {
    return (
      <section className={styles.card}>
        <p className={styles.eyebrow}>Check · answered</p>
        <Question item={item} reveal onAnswer={() => {}} />
        <div className={styles.actions}>
          <button className={styles.primary} onClick={props.onContinue}>
            Continue
          </button>
        </div>
        <CoachControls objectiveId={item.objectiveId} controls={["practice", "basics"]} />
      </section>
    );
  }

  if (phase === "reexplain" && alternate) {
    return (
      <section className={styles.card}>
        <p className={styles.eyebrow}>Explain it differently</p>
        <h2 className={styles.title}>Here&apos;s the same idea from {alternate.video.channel}</h2>
        <YouTubeClip videoId={alternate.video.id} start={alternate.span.start} end={alternate.span.end} />
        <Credit video={alternate.video} span={alternate.span} />
        <div className={styles.actions}>
          <button className={styles.primary} onClick={() => setPhase("again")}>
            Ask me again
          </button>
        </div>
      </section>
    );
  }

  const second = phase === "again" || phase === "again-right" || phase === "again-wrong";
  const asked = second && alternate ? alternate.item : item;
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>{second ? "Check · second try" : "Check"}</p>
      <Question
        key={second ? "second" : "first"}
        item={asked}
        onAnswer={(choice, confidence) => {
          const correct = choice === asked.answerIndex;
          props.onAnswer(asked, choice, confidence, !second);
          setSure(confidence === "sure");
          setPhase(second ? (correct ? "again-right" : "again-wrong") : correct ? "right" : "wrong");
        }}
      />
      {phase === "again-wrong" && !sure && (
        <p className={styles.note}>Marked shaky. It will come back in your review, so keep going.</p>
      )}
      <div className={styles.actions}>
        {phase === "wrong" && alternate && (
          <button className={styles.primary} onClick={() => setPhase("reexplain")}>
            Explain it differently
          </button>
        )}
        {phase !== "ask" && phase !== "again" && (
          <button className={phase === "wrong" && alternate ? styles.secondary : styles.primary} onClick={props.onContinue}>
            Continue
          </button>
        )}
      </div>
      {phase !== "ask" && phase !== "again" && <CoachControls objectiveId={asked.objectiveId} controls={["practice", "basics", "skip"]} />}
    </section>
  );
}

// ── Flashcards ───────────────────────────────────────────────────────────────────────────────

const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

export function CardsView(props: { concept: Concept; cards: CardItem[]; onRate: (id: string, r: Rating) => void; onContinue: () => void }) {
  const { cards } = props;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  if (!card) {
    return (
      <section className={styles.card}>
        <p className={styles.eyebrow}>Flashcards · {props.concept.title}</p>
        <h2 className={styles.title}>{cards.length} cards added to your review.</h2>
        <p className={styles.muted}>Shifu will bring each one back just before you&apos;d forget it.</p>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={props.onContinue}>
            Continue
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>
        Flashcards · {index + 1} of {cards.length}
      </p>
      <button className={cx(styles.flash, flipped && styles.flipped)} onClick={() => setFlipped(true)} disabled={flipped}>
        <span className={styles.flashFront}>{card.front}</span>
        {flipped ? <span className={styles.flashBack}>{card.back}</span> : <span className={styles.muted}>Tap to reveal</span>}
      </button>
      {flipped && (
        <div className={styles.ratings}>
          {RATINGS.map((r) => (
            <button
              key={r}
              className={styles.secondary}
              onClick={() => {
                props.onRate(card.id, r);
                setFlipped(false);
                setIndex(index + 1);
              }}
            >
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Mixed quiz ───────────────────────────────────────────────────────────────────────────────

export function QuizView(props: {
  /** "Quiz" at the end of a module, "Practice" for questions the coach added. */
  label: "Quiz" | "Practice";
  title: string;
  items: CheckItem[];
  done?: { correct: number; total: number };
  onAnswer: (item: CheckItem, choice: number, confidence: Confidence) => void;
  onFinish: (score: { correct: number; total: number }) => void;
  onContinue: () => void;
}) {
  const { items } = props;
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(false);
  const score = props.done;

  if (score) {
    return (
      <section className={styles.card}>
        <p className={styles.eyebrow}>
          {props.label} · {props.title}
        </p>
        <h2 className={styles.title}>
          {score.correct} of {score.total} right
        </h2>
        <p className={styles.muted}>
          {score.correct === score.total ? "All of it stuck." : "The ones you missed are now in your review."}
        </p>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={props.onContinue}>
            Continue
          </button>
        </div>
      </section>
    );
  }

  const item = items[index];
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>
        {props.label} · question {index + 1} of {items.length}
      </p>
      <Question
        key={item.id}
        item={item}
        onAnswer={(choice, confidence) => {
          props.onAnswer(item, choice, confidence);
          if (choice === item.answerIndex) setCorrect(correct + 1);
          setAnswered(true);
        }}
      />
      {answered && (
        <div className={styles.actions}>
          <button
            className={styles.primary}
            onClick={() => {
              setAnswered(false);
              if (index + 1 < items.length) setIndex(index + 1);
              else props.onFinish({ correct, total: items.length });
            }}
          >
            {index + 1 < items.length ? "Next question" : "See score"}
          </button>
        </div>
      )}
    </section>
  );
}
