"use client";

// The top of the lesson page (docs/design.md, "Screens"): the learner's goal as a calligraphic
// line with an ink underline that fills as the goal challenge improves, and beside it where they
// stand: concepts studied, the mastery bar, minutes watched, and how their confidence is doing.

import type { CourseView } from "@/lib/course-view";
import type { LearnerState } from "@/lib/learner";
import type { MasteryState } from "@/lib/types";
import styles from "./goal-line.module.css";

const STATES: MasteryState[] = ["solid", "learning", "shaky", "new"];
const LABEL: Record<MasteryState, string> = { solid: "solid", learning: "learning", shaky: "shaky", new: "not started" };

export function GoalLine(props: { view: CourseView; learner: LearnerState; onJump: (conceptId: string) => void }) {
  const { view, learner } = props;
  const s = view.summary(learner);
  const cal = view.calibration(learner);
  const before = view.challengeScore(learner, "before");
  const after = view.challengeScore(learner, "after");
  const latest = after ?? before;
  // The underline fills with the goal challenge; before any, with how much of the course is solid.
  const fill = latest ? latest.right / latest.of : s.objectives ? s.mastery.solid / s.objectives : 0;

  return (
    <section className={styles.goalLine} aria-label="Your goal and progress">
      <div className={styles.goal}>
        <p className={styles.eyebrow}>Your goal</p>
        <h2 className={styles.text} style={{ ["--fill" as string]: fill }}>
          <span>{view.course.plan.goal}</span>
        </h2>
        <p className={styles.score}>
          {before || after ? (
            <>
              <span className={styles.scoreLabel}>Goal challenge</span>
              {before && (
                <span className={styles.dots} aria-label={`${before.right} of ${before.of} before`}>
                  <Dots right={before.right} of={before.of} muted />
                  <span className={styles.scoreWord}>before</span>
                </span>
              )}
              {after && (
                <span className={styles.dots} aria-label={`${after.right} of ${after.of} now`}>
                  <Dots right={after.right} of={after.of} />
                  <span className={styles.scoreWord}>
                    <strong>now</strong>
                  </span>
                </span>
              )}
            </>
          ) : (
            <span className={styles.muted}>The goal challenge comes first, and again at the end.</span>
          )}
        </p>
      </div>

      <div className={styles.standing}>
        <p className={styles.stat}>
          <strong>{s.studied}</strong> of {s.concepts} concepts studied
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <strong>{s.watchedMinutes}</strong> of {s.totalMinutes} min watched
        </p>
        <div className={styles.bar} role="img" aria-label={STATES.map((st) => `${s.mastery[st]} ${LABEL[st]}`).join(", ")}>
          {STATES.map((st) => (s.mastery[st] ? <span key={st} className={styles[`seg_${st}`]} style={{ flexGrow: s.mastery[st] }} /> : null))}
        </div>
        <ul className={styles.legend}>
          {STATES.map((st) => (
            <li key={st}>
              <span className={`${styles.dot} ${styles[`dot_${st}`]}`} /> {s.mastery[st]} {LABEL[st]}
            </li>
          ))}
        </ul>
        {cal.sure >= 3 && (
          <p className={styles.calibration}>
            When you were sure, you were right <strong>{cal.sureRight}</strong> of {cal.sure} times.
            {cal.surprises.length > 0 && (
              <>
                {" "}
                Sure but wrong:{" "}
                {cal.surprises.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ", "}
                    <button className={styles.link} onClick={() => props.onJump(id.split("/")[0])}>
                      {view.objective(id)?.text ?? id}
                    </button>
                  </span>
                ))}
                .
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function Dots({ right, of, muted }: { right: number; of: number; muted?: boolean }) {
  return (
    <span className={styles.dotRow} aria-hidden="true">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < right ? (muted ? styles.dotWasRight : styles.dotRight) : styles.dotMiss} style={{ animationDelay: `${i * 70}ms` }} />
      ))}
    </span>
  );
}
