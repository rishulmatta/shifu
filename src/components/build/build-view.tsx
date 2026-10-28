"use client";

// Shown while a course is being built and nothing is playable yet (PLAN.md §3, "Starting").

import Link from "next/link";
import type { BuildProgress, BuildStep } from "@/lib/store";
import type { CoursePlan } from "@/lib/types";
import { Mark } from "../mark";
import { MindMap } from "../mind-map/mind-map";
import { ThemeToggle } from "../theme-toggle";
import styles from "./build.module.css";
import { useBuildProgress } from "./use-build-progress";

const STEPS: { step: BuildStep; label: string; model?: string }[] = [
  { step: "planning", label: "Designing the course", model: "Muse Spark" },
  { step: "finding", label: "Finding videos" },
  { step: "captions", label: "Reading captions" },
  { step: "clips", label: "Finding the right moment for each objective", model: "Muse Spark Open" },
  { step: "questions", label: "Writing and checking questions", model: "Muse Spark Open" },
];

const ORDER: BuildStep[] = ["queued", ...STEPS.map((s) => s.step), "ready"];

const STATE_LABEL = { done: "done", now: "in progress", todo: "to do" } as const;

export function BuildView(props: { slug: string; topic: string; progress: BuildProgress; plan: CoursePlan | null }) {
  const p = useBuildProgress(props.slug, props.progress);
  const at = ORDER.indexOf(p.step);
  const failed = p.step === "failed";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <Mark size={28} /> Shifu
        </Link>
        <ThemeToggle />
      </header>

      <div className={styles.columns}>
        <section className={styles.main}>
          <p className={`eyebrow ${styles.eyebrow}`}>{failed ? "Something went wrong" : "Building your course"}</p>
          <h1 className={styles.title}>{props.topic}</h1>

          {failed ? (
            <div className={styles.failed}>
              <p>{p.message}</p>
              <Link href="/" className={styles.button}>
                Try another topic
              </Link>
            </div>
          ) : (
            <>
              <ol className={styles.steps}>
                {STEPS.map((s, n) => {
                  const i = ORDER.indexOf(s.step);
                  const state = i < at ? "done" : i === at ? "now" : "todo";
                  return (
                    <li key={s.step} className={`${styles.step} ${styles[state]}`} aria-current={state === "now" ? "step" : undefined}>
                      <span className={styles.marker} style={{ animationDelay: `${n * 90}ms` }} aria-hidden="true" />
                      <span className={styles.stepBody}>
                        <span className={styles.label}>{s.label}</span>
                        <span className={styles.srOnly}>, {STATE_LABEL[state]}</span>
                        {s.model && (
                          <span className={styles.model}>
                            <span className={styles.srOnly}>, by </span>
                            {s.model}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className={styles.status} aria-live="polite">
                {p.message}
                {p.modulesTotal > 0 && ` · ${p.modulesReady} of ${p.modulesTotal} modules ready`}
              </p>
              <p className={styles.muted}>Module 1 opens as soon as it&apos;s ready; the rest keeps building while you learn.</p>
              {props.plan && (
                <div className={styles.map}>
                  <p className={`eyebrow ${styles.cardEyebrow}`}>Your map, growing</p>
                  <MindMap plan={props.plan} states={{}} available={new Set()} building />
                </div>
              )}
            </>
          )}
        </section>

        {props.plan && (
          <aside className={styles.outline} aria-label="Course outline">
            <p className={`eyebrow ${styles.cardEyebrow}`}>Your course</p>
            <ol className={styles.modules}>
              {props.plan.modules.map((m) => (
                <li key={m.index} className={styles.moduleItem} style={{ animationDelay: `${200 + m.index * 80}ms` }}>
                  <p className={styles.module}>
                    <span className={styles.moduleIndex}>{m.index + 1}</span>
                    {m.title}
                  </p>
                  <ul className={styles.concepts}>
                    {m.conceptIds.map((id) => (
                      <li key={id}>{props.plan!.concepts.find((c) => c.id === id)?.title}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </main>
  );
}

/** A slim bar above the player while later modules are still being built. */
export function BuildBanner(props: { slug: string; progress: BuildProgress }) {
  const p = useBuildProgress(props.slug, props.progress);
  if (p.step === "ready" || p.step === "failed") return null;
  return (
    <p className={styles.banner} aria-live="polite">
      <span className={styles.pulse} aria-hidden="true" />
      <span className={styles.bannerText}>
        {p.modulesReady} of {p.modulesTotal} modules ready · {p.message}
      </span>
    </p>
  );
}
