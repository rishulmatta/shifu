"use client";

import { useActionState } from "react";
import { createCourse, type CreateState } from "@/app/actions";
import styles from "./home.module.css";

const LEVELS = [
  { value: "beginner", label: "New to it" },
  { value: "intermediate", label: "Know the basics" },
  { value: "advanced", label: "Going deep" },
];

export function CreateForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createCourse, {});
  const v = state.values ?? {};

  return (
    <form action={action} className={styles.form}>
      <label className={styles.topicLabel} htmlFor="topic">
        What do you want to learn?
      </label>
      <input
        id="topic"
        name="topic"
        className={styles.topic}
        placeholder="Bayes' theorem, chord progressions, how transformers work…"
        defaultValue={v.topic}
        required
        minLength={3}
        maxLength={120}
        autoComplete="off"
      />

      <label className={styles.label} htmlFor="goal">
        Why? <span className={styles.optional}>optional</span>
      </label>
      <input id="goal" name="goal" className={styles.input} placeholder="Pass my stats exam, read papers at work…" defaultValue={v.goal} maxLength={200} />

      <div className={styles.row}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Where are you starting?</legend>
          <div className={styles.segments}>
            {LEVELS.map((l) => (
              <label key={l.value} className={styles.segment}>
                <input type="radio" name="level" value={l.value} defaultChecked={(v.level ?? "beginner") === l.value} />
                <span>{l.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={styles.fieldset}>
          <span className={styles.label}>Minutes a day</span>
          <select name="minutesPerDay" className={styles.input} defaultValue={v.minutesPerDay ?? "20"}>
            {[10, 20, 30, 45].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <button className={styles.submit} disabled={pending}>
        {pending ? "Starting your course…" : "Build my course"}
      </button>
    </form>
  );
}
