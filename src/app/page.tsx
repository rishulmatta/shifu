import Link from "next/link";
import { Suspense } from "react";
import { CreateForm } from "@/components/home/create-form";
import styles from "@/components/home/home.module.css";
import { Mark } from "@/components/mark";
import { bayesCourse } from "@/lib/fixtures/bayes";
import { recentCourses } from "@/lib/courses";

/** Course building runs in after() on this page's server action, so it gets this page's limit. */
export const maxDuration = 300;

const countClips = (timeline: { kind: string }[]) => timeline.filter((b) => b.kind === "clip").length;

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
      {cards.map((c) => (
        <li key={c.slug}>
          <Link href={`/c/${c.slug}`} className={styles.course}>
            <span className={styles.courseTitle}>{c.title}</span>
            <span className={styles.courseMeta}>{c.meta}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <Mark size={96} />
        <h1>Shifu</h1>
        <p className={styles.tagline}>Any topic, taught by the best moments on YouTube, and checked until it sticks.</p>
      </header>

      <CreateForm />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Courses</h2>
        <Suspense fallback={null}>
          <Recent />
        </Suspense>
      </section>

      <p className={styles.footnote}>Being built in public during the Meta Global AI Developer Hackathon, 27 Oct – 4 Nov 2026.</p>
    </main>
  );
}
