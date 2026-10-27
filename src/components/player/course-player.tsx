"use client";

// Walks a learner through a course timeline (PLAN.md §3), recording mastery evidence (§7) and
// resuming at the exact block where they stopped.

import Link from "next/link";
import { useMemo, useState } from "react";
import { CourseView } from "@/lib/course-view";
import { update, useLearner, withAnswer, withEvidence } from "@/lib/learner";
import { mergeCourse } from "@/lib/overlay";
import type { BuildProgress } from "@/lib/store";
import type { CardItem, CheckItem, Course } from "@/lib/types";
import { BuildBanner } from "../build/build-view";
import { Mark } from "../mark";
import { CoachPanel } from "./coach";
import { MapDialog } from "./map-dialog";
import { CardsView, CheckView, ClipView, IntroView, QuizView } from "./blocks";
import { Outline } from "./outline";
import styles from "./player.module.css";
import { TeachbackView } from "./teachback";

/**
 * `build` is set while later modules are still being built. The learner sees the course with what
 * the coach added for them merged in (overlay.ts).
 */
export function CoursePlayer({ course: shared, build }: { course: Course; build?: BuildProgress }) {
  const learner = useLearner(shared.slug);
  const merged = useMemo(() => mergeCourse(shared, learner.overlay), [shared, learner.overlay]);
  const course = merged.course;
  const view = useMemo(() => new CourseView(course), [course]);
  const { timeline } = course;
  const index = Math.min(learner.position, timeline.length);
  const block = timeline[index];
  const key = merged.keys[index];
  const concept = view.conceptAt(index);
  const [mapOpen, setMapOpen] = useState(false);
  // Concepts the coach is still building: on the map, but nothing to play yet.
  const pending = new Set(learner.overlay.concepts.filter((c) => !view.available.has(c.id)).map((c) => c.id));

  const save = (change: Parameters<typeof update>[1]) => update(course.slug, change);
  const go = (position: number) => {
    if (position < 0) return;
    save((s) => ({ ...s, position }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => go(index + 1);
  const markAnswered = (s: typeof learner) => ({ ...s, answered: [...s.answered, key] });

  let body: React.ReactNode;
  if (!block) {
    const s = view.summary(learner);
    body = (
      <section className={styles.card}>
        <p className={styles.eyebrow}>Course complete</p>
        <h2 className={styles.title}>You finished {course.plan.topic}.</h2>
        <p className={styles.lead}>
          {s.mastery.solid} of {s.objectives} objectives are solid. Come back for your reviews and the rest will follow.
        </p>
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={() => go(0)}>
            Start again from the top
          </button>
        </div>
      </section>
    );
  } else if (block.kind === "intro") {
    const c = view.concepts.get(block.conceptId)!;
    const mod = course.plan.modules.find((m) => m.index === c.moduleIndex)!;
    body = (
      <IntroView
        key={index}
        concept={c}
        module={mod}
        moduleCount={course.plan.modules.length}
        buildsOn={c.prerequisites.map((id) => view.concepts.get(id)!).filter(Boolean)}
        unfinished={view.unfinishedPrerequisites(learner, c).filter((p) => view.available.has(p.id))}
        onStart={next}
        onGoTo={(id) => go(view.introIndex(id))}
      />
    );
  } else if (block.kind === "clip") {
    const span = view.spans.get(block.spanId)!;
    body = (
      <ClipView
        key={index}
        objective={view.objective(block.objectiveId)!}
        span={span}
        video={course.videos[span.videoId]}
        onEnded={() => save((s) => (s.watched.includes(span.id) ? s : { ...s, watched: [...s.watched, span.id] }))}
        onContinue={next}
      />
    );
  } else if (block.kind === "check") {
    const item = view.items.get(block.itemId) as CheckItem;
    const altSpan = view.alternate(block.objectiveId);
    const altItem = view.checks(block.objectiveId).find((i) => i.id !== item.id) as CheckItem | undefined;
    body = (
      <CheckView
        key={index}
        item={item}
        alternate={altSpan && altItem ? { span: altSpan, video: course.videos[altSpan.videoId], item: altItem } : undefined}
        answered={learner.answered.includes(key)}
        onAnswer={(asked, choice, confidence, unaided) => save((s) => markAnswered(withAnswer(s, asked, choice, confidence, unaided)))}
        onContinue={next}
      />
    );
  } else if (block.kind === "cards") {
    body = (
      <CardsView
        key={index}
        concept={view.concepts.get(block.conceptId)!}
        cards={block.itemIds.map((id) => view.items.get(id) as CardItem)}
        onRate={(id, rating) => save((s) => ({ ...s, cards: { ...s.cards, [id]: rating } }))}
        onContinue={next}
      />
    );
  } else if (block.kind === "teachback") {
    const mod = course.plan.modules.find((m) => m.index === block.moduleIndex)!;
    const chosen = (id: string) => course.spans.find((s) => s.objectiveId === id && s.rank === 0);
    body = (
      <TeachbackView
        key={index}
        slug={course.slug}
        module={mod}
        objectives={mod.conceptIds.flatMap((id) => view.concepts.get(id)?.objectives ?? []).filter((o) => chosen(o.id))}
        clipFor={(id) => {
          const span = chosen(id);
          return span && { span, video: course.videos[span.videoId] };
        }}
        onGraded={(results) =>
          save((s) => results.reduce((acc, r) => withEvidence(acc, r.objectiveId, { kind: "teachback", verdict: r.verdict }), s))
        }
        onContinue={next}
      />
    );
  } else if (block.kind === "practice") {
    body = (
      <QuizView
        key={index}
        label="Practice"
        title={view.concepts.get(block.conceptId)?.title ?? ""}
        items={block.itemIds.flatMap((id) => (view.items.get(id) as CheckItem | undefined) ?? [])}
        done={learner.quizScores[key]}
        onAnswer={(item, choice, confidence) => save((s) => withAnswer(s, item, choice, confidence, true))}
        onFinish={(score) => save((s) => ({ ...s, quizScores: { ...s.quizScores, [key]: score } }))}
        onContinue={next}
      />
    );
  } else {
    const mod = course.plan.modules.find((m) => m.index === block.moduleIndex)!;
    body = (
      <QuizView
        key={index}
        label="Quiz"
        title={mod.title}
        items={block.itemIds.map((id) => view.items.get(id) as CheckItem)}
        done={learner.quizScores[key]}
        onAnswer={(item, choice, confidence) => save((s) => withAnswer(s, item, choice, confidence, true))}
        onFinish={(score) => save((s) => ({ ...s, quizScores: { ...s.quizScores, [key]: score } }))}
        onContinue={next}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <Mark size={28} />
          <span>Shifu</span>
        </Link>
        <span className={styles.topic}>{course.plan.topic}</span>
        <button className={styles.mapButton} onClick={() => setMapOpen(true)}>
          <MapIcon /> Mind map
        </button>
      </header>
      {mapOpen && (
        <MapDialog
          view={view}
          learner={learner}
          pending={pending}
          currentConceptId={concept?.id}
          building={!!build}
          onSelect={(id) => {
            setMapOpen(false);
            go(view.introIndex(id));
          }}
          onClose={() => setMapOpen(false)}
        />
      )}
      <div className={styles.layout}>
        <main className={styles.main}>
          {build && <BuildBanner slug={course.slug} progress={build} />}
          <div className={styles.track} aria-label={`Step ${Math.min(index + 1, timeline.length)} of ${timeline.length}`}>
            <span style={{ width: `${(Math.min(index, timeline.length) / timeline.length) * 100}%` }} />
          </div>
          {body}
          {index > 0 && block && (
            <button className={styles.back} onClick={() => go(index - 1)}>
              ← Back
            </button>
          )}
        </main>
        <Outline
          view={view}
          learner={learner}
          pending={pending}
          currentConceptId={concept?.id}
          building={!!build}
          onJump={(id) => go(view.introIndex(id))}
          onOpenMap={() => setMapOpen(true)}
          coach={<CoachPanel shared={shared} merged={merged} view={view} learner={learner} index={index} conceptId={concept?.id} go={go} />}
        />
      </div>
    </div>
  );
}

function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="3.5" cy="4" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.5" cy="4" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 5.4 L7 10.4 M11 5.4 L9 10.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
