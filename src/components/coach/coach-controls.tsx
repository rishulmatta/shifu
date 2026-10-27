"use client";

// The coach's controls under a clip or an answered question (PLAN.md §3, "The course coach"): the
// requests a learner makes most, aimed at this objective, without typing. Each opens the coach
// window, where the change and where it lands are shown.

import { Mark } from "../mark";
import { askCoach, type CoachRequest } from "./ask";
import styles from "./coach.module.css";

export type Control = "practice" | "basics" | "skip";

const REQUEST: Record<Control, (objectiveId: string) => CoachRequest> = {
  practice: (objectiveId) => ({ text: "More practice on this", intent: { kind: "practice", objectiveId } }),
  basics: (objectiveId) => ({ text: "I'm missing the basics", intent: { kind: "basics", objectiveId } }),
  skip: () => ({ text: "Skip, I know this", local: "skip" }),
};

export function CoachControls({ objectiveId, controls }: { objectiveId: string; controls: Control[] }) {
  return (
    <div className={styles.controls} role="group" aria-label="Ask the coach">
      <span className={styles.controlsMark} aria-hidden="true">
        <Mark size={20} />
      </span>
      {controls.map((c) => {
        const request = REQUEST[c](objectiveId);
        return (
          <button key={c} className={styles.control} onClick={() => askCoach(request)}>
            {request.text}
          </button>
        );
      })}
    </div>
  );
}
