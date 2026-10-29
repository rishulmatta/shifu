"use client";

// A vermilion thread from the current node of the progression to the lesson card, so the learner
// always sees where they are (docs/design.md, "The progression"). Drawn on a fixed overlay from the
// two elements' positions, redrawn as they move.

import { useEffect, useState } from "react";
import styles from "./thread.module.css";

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function Thread(props: { from: string; to: string; /** Redraw when this changes. */ index: number }) {
  const [line, setLine] = useState<Line | null>(null);
  const { from, to, index } = props;

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const a = document.querySelector<HTMLElement>(from);
      const b = document.querySelector<HTMLElement>(to);
      if (!a || !b || window.innerWidth <= 900) return setLine(null);
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      // The node must be visible inside its scroll box for the thread to mean anything.
      const box = a.closest("nav")?.getBoundingClientRect();
      if (box && (ra.bottom < box.top || ra.top > box.bottom)) return setLine(null);
      // And the card must be on screen, or the thread would lead off the page.
      if (rb.top > window.innerHeight - 80 || rb.bottom < 60) return setLine(null);
      setLine({ x1: ra.right, y1: ra.top + ra.height / 2, x2: rb.left, y2: Math.max(rb.top + 44, Math.min(ra.top + ra.height / 2, rb.bottom - 24)) });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // The lesson card changes height as it settles, so measure again shortly after each change.
    schedule();
    const later = setTimeout(measure, 520);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      clearTimeout(later);
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [from, to, index]);

  if (!line) return null;
  const dx = Math.max(24, (line.x2 - line.x1) * 0.6);
  const d = `M ${line.x1} ${line.y1} C ${line.x1 + dx} ${line.y1}, ${line.x2 - dx} ${line.y2}, ${line.x2} ${line.y2}`;
  return (
    <svg className={styles.thread} aria-hidden="true">
      <path key={index} d={d} className={styles.line} />
      <circle cx={line.x1} cy={line.y1} r="3" className={styles.end} />
      <rect key={`seal-${index}`} x={line.x2 - 5} y={line.y2 - 5} width="10" height="10" rx="2" className={styles.seal} />
    </svg>
  );
}
