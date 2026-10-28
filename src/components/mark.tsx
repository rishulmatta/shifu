// The Shifu mark (docs/design.md): an ensō, the master's single brush stroke, with a vermilion seal
// stamped inside it and a play triangle cut through the seal. The ink follows `currentColor`.

import styles from "./mark.module.css";
import { ENSO_PATH, ENSO_START, FLECKS, SEAL_PATH } from "./mark-path";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

/** The seal's outline alone, without the play triangle cut through it. */
const SEAL_SQUARE = SEAL_PATH.slice(0, SEAL_PATH.indexOf("M", 1));

export function Mark(props: {
  size?: number;
  /** Draw the stroke on and stamp the seal, as on the home page; the mark sits still otherwise. */
  animate?: boolean;
  className?: string;
}) {
  const { size = 96, animate } = props;
  return (
    <span
      className={cx(styles.mark, animate && styles.animate, props.className)}
      style={{ width: size, height: size, ["--enso-start" as string]: `${ENSO_START}deg` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" className={styles.enso}>
        <path d={ENSO_PATH} fill="currentColor" />
        {FLECKS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="currentColor" className={styles.fleck} style={{ animationDelay: `${1000 + i * 70}ms` }} />
        ))}
      </svg>
      <svg viewBox="0 0 200 200" className={styles.seal}>
        <path d={SEAL_PATH} fill="var(--vermilion)" fillRule="evenodd" />
      </svg>
    </span>
  );
}

/**
 * The seal alone, stamped on something the learner got right. `children` is what the seal says
 * (a check mark by default, drawn in the 200 × 200 view box); `stamp` plays the stamping on mount.
 */
export function Seal(props: { size?: number; stamp?: boolean; className?: string; label?: string; children?: React.ReactNode }) {
  const { size = 40, stamp } = props;
  return (
    <span
      className={cx(styles.sealOnly, stamp && styles.stamp, props.className)}
      style={{ width: size, height: size }}
      role={props.label ? "img" : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : true}
    >
      {/* The view box is cropped to the seal, so `size` is the size of the seal itself. */}
      <svg viewBox="62 62 76 76">
        <path d={SEAL_SQUARE} fill="var(--vermilion)" />
        {props.children ?? <path d="M70 104 L91 124 L131 78" fill="none" stroke="var(--paper)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}
