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

/** A repeatable 0–1 from an index, so the server and the browser throw the same flecks. */
const rand = (i: number, salt: number) => {
  // An integer hash (mulberry32's mix): exact on every engine, unlike anything built on Math.sin.
  let t = (i * 0x9e3779b9 + salt * 0x85ebca6b) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Ink thrown off a brush or a stamp: `count` flecks spray out from the element's centre once, on
 * mount, then fade. Position it with `className` (it is absolutely positioned, zero-size, at the
 * point they fly from); the ink is `currentColor`, `spread` is roughly how far they fly in px.
 */
export function Flecks(props: { count?: number; spread?: number; delay?: number; className?: string }) {
  const { count = 14, spread = 46, delay = 0 } = props;
  // Pure and seeded by index (no Math.random), so it renders the same on the server and the client
  // and needs no hook: the mark stays usable from server components.
  const flecks = Array.from({ length: count }, (_, i) => {
    // Evenly round the circle with a jitter, so no side is bare and none looks ruled.
    const angle = (i / count) * 360 + (rand(i, 1) - 0.5) * (300 / count);
    const far = rand(i, 2);
    return {
      angle: Math.round(angle),
      distance: Math.round(spread * (0.55 + far * 0.75)),
      // The ones that fly furthest are the smallest; a few are drawn out by their speed.
      size: +(2.6 + (1 - far) * 3.4 * rand(i, 3)).toFixed(1),
      stretch: rand(i, 4) > 0.6 ? +(1.6 + rand(i, 5)).toFixed(2) : 1,
      lag: Math.round(rand(i, 6) * 70),
    };
  });
  return (
    <span className={cx(styles.flecks, props.className)} aria-hidden="true">
      {flecks.map((f, i) => (
        <span
          key={i}
          className={styles.fleckDot}
          style={
            {
              "--angle": `${f.angle}deg`,
              "--distance": `${f.distance}px`,
              "--stretch": f.stretch,
              width: f.size,
              height: f.size,
              animationDelay: `${delay + f.lag}ms`,
            } as React.CSSProperties
          }
        />
      ))}
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
