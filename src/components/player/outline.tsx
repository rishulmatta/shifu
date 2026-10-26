"use client";

// The progress tracker and course outline beside the player (PLAN.md §7): concepts studied, the
// mastery bar, minutes watched, and every concept with one dot per objective.

import type { CourseView } from "@/lib/course-view";
import type { LearnerState } from "@/lib/learner";
import type { MasteryState } from "@/lib/types";
import styles from "./player.module.css";

const STATES: MasteryState[] = ["solid", "learning", "shaky", "new"];
const LABEL: Record<MasteryState, string> = { solid: "Solid", learning: "Learning", shaky: "Shaky", new: "Not started" };

export function Outline(props: { view: CourseView; learner: LearnerState; currentConceptId?: string; onJump: (conceptId: string) => void }) {
  const { view, learner } = props;
  const s = view.summary(learner);

  return (
    <aside className={styles.aside} aria-label="Course progress">
      <div className={styles.progress}>
        <p className={styles.eyebrow}>Your progress</p>
        <p className={styles.stat}>
          <strong>{s.studied}</strong> of {s.concepts} concepts studied
        </p>
        <div className={styles.bar} role="img" aria-label={STATES.map((st) => `${s.mastery[st]} ${LABEL[st].toLowerCase()}`).join(", ")}>
          {STATES.map((st) =>
            s.mastery[st] ? <span key={st} className={styles[`seg_${st}`]} style={{ flexGrow: s.mastery[st] }} /> : null,
          )}
        </div>
        <ul className={styles.legend}>
          {STATES.map((st) => (
            <li key={st}>
              <span className={`${styles.dot} ${styles[`dot_${st}`]}`} /> {s.mastery[st]} {LABEL[st].toLowerCase()}
            </li>
          ))}
        </ul>
        <p className={styles.muted}>
          {s.watchedMinutes} of {s.totalMinutes} min watched
        </p>
      </div>

      <ol className={styles.modules}>
        {view.course.plan.modules.map((m) => (
          <li key={m.index}>
            <p className={styles.moduleTitle}>
              {m.index + 1}. {m.title}
            </p>
            <ul className={styles.concepts}>
              {m.conceptIds.map((id) => {
                const c = view.concepts.get(id);
                if (!c) return null;
                return (
                  <li key={id}>
                    <button
                      className={`${styles.concept} ${id === props.currentConceptId ? styles.current : ""}`}
                      onClick={() => props.onJump(id)}
                      aria-current={id === props.currentConceptId ? "step" : undefined}
                    >
                      <span className={styles.dots}>
                        {c.objectives.map((o) => (
                          <span key={o.id} className={`${styles.dot} ${styles[`dot_${view.objectiveState(learner, o.id)}`]}`} />
                        ))}
                      </span>
                      {c.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </aside>
  );
}
