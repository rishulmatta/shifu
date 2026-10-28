import Link from "next/link";
import { Suspense } from "react";
import { CreateForm } from "@/components/home/create-form";
import styles from "@/components/home/home.module.css";
import { Mark, Seal } from "@/components/mark";
import { ENSO_PATH } from "@/components/mark-path";
import { ThemeToggle } from "@/components/theme-toggle";
import { bayesCourse } from "@/lib/fixtures/bayes";
import { recentCourses } from "@/lib/courses";

/** Course building runs in after() on this page's server action, so it gets this page's limit. */
export const maxDuration = 300;

const countClips = (timeline: { kind: string }[]) => timeline.filter((b) => b.kind === "clip").length;

/** The hero lands as the brush lifts: the seal stamps at ~1.05 s, so the text rises to meet it. */
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

async function Recent() {
  const records = await recentCourses();
  const cards = [
    { slug: bayesCourse.slug, title: `${bayesCourse.plan.topic} (sample)`, meta: `${countClips(bayesCourse.timeline)} clips · hand-made` },
    ...records.map((r) => ({
      slug: r.slug,
      title: r.input.topic,
      meta: `${r.course ? countClips(r.course.timeline) : 0} clips from ${r.course ? Object.keys(r.course.videos).length : 0} videos`,
    })),
  ];
  return (
    <ul className={styles.courses}>
      {cards.map((c, i) => (
        <li key={c.slug} className={styles.courseItem} style={delay(980 + i * 60)}>
          <Link href={`/c/${c.slug}`} className={styles.course}>
            <span className={styles.courseTitle}>{c.title}</span>
            <span className={styles.courseMeta}>{c.meta}</span>
            <Seal size={22} className={styles.courseSeal}>
              <path d="M88 76 L132 100 L88 124 Z" fill="var(--surface)" />
            </Seal>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.wash} aria-hidden="true">
        <svg viewBox="0 0 200 200" className={styles.washEnso}>
          <path d={ENSO_PATH} fill="currentColor" />
        </svg>
      </div>

      <ThemeToggle className={styles.toggle} />

      <div className={styles.inner}>
        <header className={styles.hero}>
          <Mark size={120} animate />
          <h1 className={styles.rise} style={delay(450)}>
            Shifu
          </h1>
          <p className={`${styles.tagline} ${styles.rise}`} style={delay(580)}>
            Any topic, taught by the best moments on YouTube, and checked until it sticks.
          </p>
          <p className={`${styles.models} ${styles.rise}`} style={delay(700)}>
            <span className={styles.srOnly}>Built with Meta&apos;s models: </span>
            <span className={styles.model}>Muse Spark 1.3</span> <span aria-hidden="true">·</span> <span className={styles.model}>Muse Spark Open</span>{" "}
            <span aria-hidden="true">·</span> <span className={styles.model}>Muse Voice Transcribe</span>
          </p>
        </header>

        <div className={styles.rise} style={delay(800)}>
          <CreateForm />
        </div>

        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.rise}`} style={delay(920)}>
            Courses
          </h2>
          <Suspense fallback={null}>
            <Recent />
          </Suspense>
        </section>

        <p className={styles.footnote}>Being built in public during the Meta Global AI Developer Hackathon, 27 Oct – 4 Nov 2026.</p>
      </div>
    </main>
  );
}
