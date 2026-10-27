"use client";

// Shown while a course is being built and nothing is playable yet (PLAN.md §3, "Starting").

import Link from "next/link";
import type { BuildProgress, BuildStep } from "@/lib/store";
import type { CoursePlan } from "@/lib/types";
import { Mark } from "../mark";
import { MindMap } from "../mind-map/mind-map";
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

export function BuildView(props: { slug: string; topic: string; progress: BuildProgress; plan: CoursePlan | null }) {
  const p = useBuildProgress(props.slug, props.progress);
  const at = ORDER.indexOf(p.step);

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.brand}>
        <Mark size={28} /> Shifu
      </Link>
      <div className={styles.columns}>
        <section>
          <p className={styles.eyebrow}>{p.step === "failed" ? "Something went wrong" : "Building your course"}</p>
          <h1 className={styles.title}>{props.topic}</h1>

          {p.step === "failed" ? (
            <div className={styles.failed}>
              <p>{p.message}</p>
              <Link href="/" className={styles.button}>
                Try another topic
              </Link>
            </div>
          ) : (
            <>
              <ol className={styles.steps}>
                {STEPS.map((s) => {
                  const i = ORDER.indexOf(s.step);
                  const state = i < at ? "done" : i === at ? "now" : "todo";
                  return (
                    <li key={s.step} className={styles[state]}>
                      <span className={styles.marker} aria-hidden="true" />
                      <span>
                        {s.label}
                        {s.model && <span className={styles.model}> · {s.model}</span>}
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
                  <MindMap plan={props.plan} states={{}} available={new Set()} building />
                </div>
              )}
            </>
          )}
        </section>

        {props.plan && (
          <aside className={styles.outline} aria-label="Course outline">
            <p className={styles.eyebrow}>Your course</p>
            <ol>
              {props.plan.modules.map((m) => (
                <li key={m.index}>
                  <p className={styles.module}>
                    {m.index + 1}. {m.title}
                  </p>
                  <ul>
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
      <span className={styles.pulse} aria-hidden="true" /> {p.modulesReady} of {p.modulesTotal} modules ready · {p.message}
    </p>
  );
}
