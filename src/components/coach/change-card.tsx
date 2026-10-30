"use client";

// The card under a coach reply: what changed and where it lands in the learner's path. Inserted
// questions show as squares after a caret at the learner's place, like an insertion mark in a
// manuscript; a new concept shows as a node growing in front of the concept that needs it (a
// prerequisite) or after the one it builds on (a lesson the learner asked for), with the build's
// four steps filling in beneath.

import type { CoachChange } from "@/lib/learner";
import { wrap } from "../mind-map/layout";
import styles from "./coach.module.css";

const STEP_LABELS = ["Finding videos", "Reading captions", "Picking the moments", "Writing questions"];

export function ChangeCard(props: { change: CoachChange; here?: string; onStart?: () => void; onShowMap?: () => void }) {
  const { change } = props;
  return (
    <div className={`${styles.card} ${styles[`card_${change.status}`]}`}>
      {(change.kind === "practice" || change.kind === "reexplain") && <PathStrip change={change} here={props.here} />}
      {(change.kind === "prerequisite" || change.kind === "extend") && change.concept && <Growth change={change} />}
      <div className={styles.status}>
        <span className={styles.statusIcon} aria-hidden="true">
          {change.status === "working" ? <span className={styles.spinner} /> : change.status === "done" ? "✓" : "✕"}
        </span>
        <span className={styles.note}>{change.note}</span>
      </div>
      {change.status === "done" && (props.onStart || props.onShowMap) && (
        <div className={styles.cardActions}>
          {props.onStart && (
            <button className={styles.start} onClick={props.onStart}>
              Start now
            </button>
          )}
          {props.onShowMap && (
            <button className={styles.textButton} onClick={props.onShowMap}>
              Show on map
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Where inserted blocks land: after the learner's place, before the rest of the lesson. */
function PathStrip({ change, here }: { change: CoachChange; here?: string }) {
  const n = change.kind === "reexplain" ? 2 : (change.count ?? 3);
  const label =
    change.kind === "reexplain" ? "A clip and a question inserted after where you are" : `${n} questions inserted after where you are`;
  return (
    <div className={styles.strip} role="img" aria-label={label}>
      <span className={styles.stop}>
        <span className={styles.dotNow} />
        <span className={styles.stopLabel}>{here ?? "Now"}</span>
      </span>
      <span className={styles.caret}>‸</span>
      <span className={styles.inserted}>
        {Array.from({ length: n }, (_, i) =>
          change.kind === "reexplain" && i === 0 ? (
            <svg key={i} className={styles.clipIcon} width="18" height="14" viewBox="0 0 18 14">
              <rect x="1" y="1" width="16" height="12" rx="3" />
              <path d="M7.5 4.5 L11.5 7 L7.5 9.5 Z" />
            </svg>
          ) : (
            <span key={i} className={styles.square} style={{ animationDelay: `${i * 90}ms` }} />
          ),
        )}
      </span>
      <span className={styles.stop}>
        <span className={styles.dotThen} />
        <span className={styles.stopLabel}>then on</span>
      </span>
    </div>
  );
}

/**
 * A new concept beside the one it's linked to (in front of the concept that builds on it, or after
 * the one it builds on), and how far its build has got.
 */
function Growth({ change }: { change: CoachChange }) {
  const step = change.status === "done" ? 4 : (change.step ?? 0);
  const label = (text: string) => wrap(text, 118, 6.3, 2);
  const follows = change.kind === "extend";
  const neighbour = change.before ?? change.after ?? "This concept";
  const [newX, hereX] = follows ? [244, 52] : [52, 244];
  return (
    <div className={styles.growth}>
      <svg viewBox="0 0 300 96" width="100%" role="img" aria-label={`${change.concept!.title}, added ${follows ? "after" : "before"} ${neighbour}`}>
        <defs>
          <marker id="coach-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" className={styles.arrowHead} />
          </marker>
        </defs>
        <path d="M 74 30 L 220 30" className={`${styles.link} ${change.status === "working" ? styles.linkWorking : ""}`} markerEnd="url(#coach-arrow)" />
        <g transform={`translate(${newX} 30)`}>
          <circle r="17" className={`${styles.newNode} ${styles[`newNode_${change.status}`]}`} />
          <text dy="0.35em" className={styles.plus}>
            +
          </text>
        </g>
        <g transform={`translate(${hereX} 30)`}>
          <circle r="17" className={styles.hereNode} />
        </g>
        {[
          { x: newX, lines: label(change.concept!.title), strong: true },
          { x: hereX, lines: label(neighbour), strong: false },
        ].map((l) => (
          <text key={l.x} x={l.x} y="64" className={l.strong ? styles.nodeLabelStrong : styles.nodeLabel}>
            {l.lines.map((line, i) => (
              <tspan key={i} x={l.x} dy={i === 0 ? 0 : 13}>
                {line}
              </tspan>
            ))}
          </text>
        ))}
      </svg>
      {change.status !== "failed" && (
        <div className={styles.steps} role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={step} aria-valuetext={STEP_LABELS[Math.min(step, 3)]}>
          {STEP_LABELS.map((s, i) => (
            <span key={s} className={i < step ? styles.stepDone : i === step ? styles.stepNow : styles.stepTodo} title={s} />
          ))}
        </div>
      )}
    </div>
  );
}
