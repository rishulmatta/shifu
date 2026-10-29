// The lesson's ink wash (docs/design.md, "Screens"): a few large pools of the paper's own tones
// behind everything, drifting so slowly they are felt rather than seen. The mood tints them: warm
// while a clip plays, gold while a question waits, jade on a right answer, a brief red flush on a
// wrong one that settles, plain paper otherwise. Fixed, behind the content (z-index 0), and inert.

import styles from "./ink-wash.module.css";

export type InkMood = "watch" | "ask" | "right" | "wrong" | "calm";

/** Each pool carries one layer per tinted mood; a mood change cross-fades them (opacity only). */
const TINTS = ["watch", "ask", "right", "wrong"] as const;

export function InkWash({ mood }: { mood: InkMood }) {
  return (
    <div className={styles.wash} data-mood={mood} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${styles.drift} ${styles[`drift${i}`]}`}>
          <div className={styles.pool} />
          {TINTS.map((t) => (
            <div key={t} className={`${styles.pool} ${styles.tint} ${styles[t]}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
