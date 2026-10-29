// Ink inside an answer option (docs/design.md, "Motion"): a faint pool bleeding out from the cursor
// while it hovers, one brush pass of ink across the right answer and a red slash through a wrong
// pick. The layer sits under the option's text; the option itself only tracks the pointer.

import { useId } from "react";
import styles from "./ink.module.css";

/** `onPointerMove` for an option: where the pool should gather, as --x/--y on the element. */
export function trackInk(event: React.PointerEvent<HTMLElement>) {
  const el = event.currentTarget;
  const box = el.getBoundingClientRect();
  el.style.setProperty("--x", `${Math.round(event.clientX - box.left)}px`);
  el.style.setProperty("--y", `${Math.round(event.clientY - box.top)}px`);
}

/**
 * The ink, as the option's first children: `mark` is how the answer was marked, once it is. The
 * pool and the brush pass sit under the text; the slash goes through it. On the right answer a
 * paper-coloured copy of `text` is revealed with the stroke, so the words turn to paper exactly
 * where the brush has passed and nowhere else.
 */
export function OptionInk({ mark, text }: { mark?: "right" | "wrong"; text?: React.ReactNode }) {
  return (
    <>
      <span className={styles.layer} aria-hidden="true">
        <span className={styles.pool} />
        {mark === "right" && <Stroke />}
      </span>
      {mark === "right" && (
        <span className={styles.reversed} aria-hidden="true">
          <span className={styles.markerSpace} />
          <span>{text}</span>
        </span>
      )}
      {mark === "wrong" && <Slash />}
    </>
  );
}

/** A filter id usable in url(#…): useId's colons are fine in SVG, but keep it plain anyway. */
const useFilterId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

/**
 * One loaded brush dragged across the option: a blunt landing on the left, edges that waver as the
 * bristles lift and press, and the bristles parting into dry streaks where the ink runs out.
 */
/** The bristles that part at the end of the stroke: [top, bottom, where they part, where they lift]. */
const BRISTLES: [number, number, number, number][] = [
  [5, 16, 492, 590],
  [18, 25, 470, 548],
  [27, 40, 506, 598],
  [42, 48, 484, 562],
  [50, 62, 498, 588],
  [64, 70, 476, 554],
  [72, 85, 502, 596],
  [87, 95, 488, 572],
];

/** Where the ink thins inside the body before the bristles part: [y, from, to]. */
const DRY: [number, number, number][] = [
  [17, 400, 520],
  [41, 440, 530],
  [63, 380, 520],
  [86, 430, 520],
];

function Stroke() {
  const rough = useFilterId("brush");
  const dry = useFilterId("dry");
  return (
    <svg className={styles.stroke} viewBox="0 0 600 100" preserveAspectRatio="none">
      <defs>
        <filter id={rough} x="-2%" y="-10%" width="104%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.14" numOctaves="2" seed="5" />
          <feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Streaks of paper showing through where the brush starts to run dry. */}
        <mask id={dry} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="100">
          <rect width="600" height="100" fill="#fff" />
          {DRY.map(([y, from, to], i) => (
            <path key={i} d={`M${from} ${y} L ${to} ${y - 1.4} L ${to} ${y + 1.6} Z`} fill="#000" />
          ))}
        </mask>
      </defs>
      <g filter={`url(#${rough})`} fill="var(--ink)">
        <g mask={`url(#${dry})`}>
          <path d="M12 9 C 140 3 330 11 506 7 C 520 30 512 70 508 94 C 330 90 140 98 12 92 C 1 78 0 24 12 9 Z" />
        </g>
        {BRISTLES.map(([top, bottom, from, end], i) => {
          const tip = top + (bottom - top) * 0.45;
          return <path key={i} d={`M${from} ${top} L ${end} ${tip} L ${end - 10} ${tip + 1.2} L ${from} ${bottom} Z`} />;
        })}
      </g>
    </svg>
  );
}

/** One red stroke through a wrong pick: heavy where the brush lands on the left, a dry tail out right. */
function Slash() {
  const rough = useFilterId("slash");
  return (
    <svg className={styles.slash} aria-hidden="true" viewBox="0 0 400 40" preserveAspectRatio="none">
      <filter id={rough} x="-5%" y="-40%" width="110%" height="180%">
        <feTurbulence type="fractalNoise" baseFrequency="0.08 0.5" numOctaves="2" seed="7" />
        <feDisplacementMap in="SourceGraphic" scale="3.6" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <g filter={`url(#${rough})`} fill="var(--vermilion)">
        <path d="M9 24 C 70 21.5 150 18 225 15.2 C 300 12.6 355 10.8 395 9.6 L 394 12.4 C 352 14.6 296 17.8 224 21.8 C 150 25.8 74 30.6 12 34.4 C 4 34.8 2.6 25.2 9 24 Z" />
        <path d="M236 21.4 C 300 18.2 352 15.8 390 14.6 L 389 15.6 C 350 17 300 19.6 240 22.6 Z" opacity="0.75" />
      </g>
    </svg>
  );
}
