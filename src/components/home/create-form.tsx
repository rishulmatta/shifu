"use client";

import { useActionState, useEffect, useState } from "react";
import { createCourse, type CreateState } from "@/app/actions";
import styles from "./home.module.css";

const LEVELS = [
  { value: "beginner", label: "New to it" },
  { value: "intermediate", label: "Know the basics" },
  { value: "advanced", label: "Going deep" },
];

/** Shown before the typewriter starts, under reduced motion, and once the learner has typed. */
const STATIC_PLACEHOLDER = "Bayes' theorem, chord progressions, how transformers work…";

const EXAMPLES = ["Bayes' theorem", "attention in transformers", "chord progressions", "how vaccines train the immune system", "the Rust borrow checker"];

const TYPE_MS = 55;
const ERASE_MS = 24;
const HOLD_MS = 1900;
const GAP_MS = 380;

/**
 * Types the example topics into the placeholder one after another, gently, until `stopped`.
 * Under prefers-reduced-motion it leaves the static placeholder alone.
 */
function useRotatingPlaceholder(stopped: boolean) {
  const [text, setText] = useState(STATIC_PLACEHOLDER);

  useEffect(() => {
    if (stopped || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let example = 0;
    let shown = 0;
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const full = EXAMPLES[example];
      if (!erasing) {
        shown += 1;
        setText(full.slice(0, shown));
        if (shown >= full.length) {
          erasing = true;
          timer = setTimeout(tick, HOLD_MS);
          return;
        }
        timer = setTimeout(tick, TYPE_MS + Math.random() * 40);
      } else {
        shown -= 1;
        setText(shown > 0 ? full.slice(0, shown) : "");
        if (shown <= 0) {
          erasing = false;
          example = (example + 1) % EXAMPLES.length;
          timer = setTimeout(tick, GAP_MS);
          return;
        }
        timer = setTimeout(tick, ERASE_MS);
      }
    };
    timer = setTimeout(tick, 1400);
    return () => clearTimeout(timer);
  }, [stopped]);

  return stopped ? STATIC_PLACEHOLDER : text;
}

export function CreateForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createCourse, {});
  const v = state.values ?? {};
  const [typed, setTyped] = useState(false);
  const placeholder = useRotatingPlaceholder(typed || Boolean(v.topic));

  return (
    <form action={action} className={styles.form}>
      <label className={styles.topicLabel} htmlFor="topic">
        What do you want to learn?
      </label>
      <div className={styles.topicWell}>
        <input
          id="topic"
          name="topic"
          className={styles.topic}
          placeholder={placeholder}
          defaultValue={v.topic}
          onChange={() => setTyped(true)}
          required
          minLength={3}
          maxLength={120}
          autoComplete="off"
        />
      </div>

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
          <span className={styles.selectWrap}>
            <select name="minutesPerDay" className={`${styles.input} ${styles.select}`} defaultValue={v.minutesPerDay ?? "20"}>
              {[10, 20, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <button className={styles.submit} disabled={pending} aria-busy={pending || undefined}>
        {pending && <span className={styles.spinner} aria-hidden="true" />}
        {pending ? "Starting your course…" : "Build my course"}
      </button>
    </form>
  );
}
