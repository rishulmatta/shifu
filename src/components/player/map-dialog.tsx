"use client";

// The mind map at full size (PLAN.md §3): opened from the header or the progress panel. Picking a
// concept goes there; Escape or the close button returns to the lesson.

import { useEffect, useRef } from "react";
import type { CourseView } from "@/lib/course-view";
import type { LearnerState } from "@/lib/learner";
import type { MasteryState } from "@/lib/types";
import { MindMap } from "../mind-map/mind-map";
import styles from "./player.module.css";

const LEGEND: { state: MasteryState; label: string }[] = [
  { state: "solid", label: "Solid" },
  { state: "learning", label: "Learning" },
  { state: "shaky", label: "Shaky" },
  { state: "new", label: "Not started" },
];

export function MapDialog(props: {
  view: CourseView;
  learner: LearnerState;
  currentConceptId?: string;
  building: boolean;
  pending: ReadonlySet<string>;
  onSelect: (conceptId: string) => void;
  onClose: () => void;
}) {
  const { view, learner } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const s = view.summary(learner);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} className={styles.mapDialog} onClose={props.onClose} aria-labelledby="map-title">
      <header className={styles.mapHead}>
        <div>
          <p className={styles.eyebrow}>Mind map</p>
          <h2 id="map-title" className={styles.title}>
            {view.course.plan.topic}
          </h2>
          <p className={styles.muted}>
            {s.studied} of {s.concepts} concepts studied · {s.mastery.solid} of {s.objectives} objectives solid
          </p>
        </div>
        <button className={styles.secondary} onClick={() => dialog.current?.close()}>
          Close
        </button>
      </header>
      <MindMap
        plan={view.course.plan}
        states={view.objectiveStates(learner)}
        available={view.available}
        building={props.building}
        pending={props.pending}
        currentConceptId={props.currentConceptId}
        onSelect={props.onSelect}
      />
      <footer className={styles.mapFoot}>
        <ul className={styles.mapLegend}>
          {LEGEND.map((l) => (
            <li key={l.state}>
              <span className={`${styles.dot} ${styles[`dot_${l.state}`]}`} /> {l.label}
            </li>
          ))}
          <li className={styles.muted}>One ring segment per objective · lines lead from what a concept builds on</li>
        </ul>
        <p className={styles.muted}>Pick a concept to go there.</p>
      </footer>
    </dialog>
  );
}
