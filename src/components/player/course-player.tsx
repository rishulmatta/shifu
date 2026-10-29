"use client";

// Walks a learner through a course timeline (PLAN.md §3), recording mastery evidence (§7) and
// resuming at the exact block where they stopped.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CourseView } from "@/lib/course-view";
import { update, useLearner, withAnswer, withEvidence } from "@/lib/learner";
import { mergeCourse } from "@/lib/overlay";
import type { BuildProgress } from "@/lib/store";
import type { Block, CardItem, CheckItem, Course } from "@/lib/types";
import { BuildBanner } from "../build/build-view";
import { Mark, Seal } from "../mark";
import { ThemeToggle } from "../theme-toggle";
import { MAP_EVENT } from "../coach/ask";
import { Coach } from "../coach/coach";
import { ChallengeView } from "./challenge";
import { MapDialog } from "./map-dialog";
import { MindMap } from "../mind-map/mind-map";
import { CardsView, CheckView, ClipView, IntroView, QuizView } from "./blocks";
import { GoalLine } from "./goal-line";
import { type InkMood, InkWash } from "./ink-wash";
import styles from "./player.module.css";
import { Progression } from "./progression";
import { TeachbackView } from "./teachback";
import { Thread } from "./thread";

/** "Part 2 of 3": where a clip sits among its concept's clips. */
function partOf(timeline: Block[], index: number) {
  let start = index;
  while (start > 0 && timeline[start].kind !== "intro") start--;
  const clips: number[] = [];
  for (let i = start; i < timeline.length && (i === start || timeline[i].kind !== "intro"); i++) if (timeline[i].kind === "clip") clips.push(i);
  return { n: clips.indexOf(index) + 1, of: clips.length };
}

/** The block after this one, in words, for "Up next". */
function describe(block: Block | undefined, view: CourseView, course: Course): string | undefined {
  if (!block) return "the end of the course";
  switch (block.kind) {
    case "check":
      return "a quick check";
    case "clip": {
      const span = view.spans.get(block.spanId);
      const channel = span && course.videos[span.videoId]?.channel;
      return channel ? `the next clip, from ${channel}` : "the next clip";
    }
    case "cards":
      return "flashcards";
    case "practice":
      return "practice questions";
    case "quiz":
      return "the chapter quiz";
    case "teachback":
      return "teaching it back";
    case "challenge":
      return "the goal challenge";
    case "intro":
      return view.concepts.get(block.conceptId)?.title;
  }
}

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
  // The full map: open, and the concept it picks out ("Show on map" from the coach).
  const [map, setMap] = useState<{ focus?: string } | null>(null);
  // The ink wash behind the page follows the lesson: warm while a clip plays, jade on a right answer.
  const [verdict, setVerdict] = useState<{ index: number; mood: "right" | "wrong" } | null>(null);
  const mood: InkMood =
    verdict?.index === index ? verdict.mood : !block ? "right" : block.kind === "clip" ? "watch" : block.kind === "check" || block.kind === "quiz" || block.kind === "practice" || block.kind === "challenge" ? "ask" : "calm";
  const judge = (correct: boolean) => setVerdict({ index, mood: correct ? "right" : "wrong" });
  const added = new Set(learner.overlay.concepts.map((c) => c.id));
  // Concepts the coach is still building: on the map, but nothing to play yet.
  const pending = new Set([...added].filter((id) => !view.available.has(id)));
  useEffect(() => {
    const onShow = (e: Event) => setMap({ focus: (e as CustomEvent<string>).detail });
    window.addEventListener(MAP_EVENT, onShow);
    return () => window.removeEventListener(MAP_EVENT, onShow);
  }, []);

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
      <section className={`${styles.card} ${styles.complete}`}>
        <Seal size={72} stamp className={styles.completeSeal} />
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
        known={view.knownBefore(learner, c)}
        onSkip={() => {
          const after = timeline.findIndex((b, i) => i > index && b.kind === "intro");
          go(after < 0 ? timeline.length : after);
        }}
        onStart={next}
        onGoTo={(id) => go(view.introIndex(id))}
      />
    );
  } else if (block.kind === "challenge") {
    const stage = block.stage;
    body = (
      <ChallengeView
        key={index}
        stage={stage}
        goal={course.plan.goal}
        challenges={course.challenges ?? []}
        answers={learner.challenge}
        conceptOf={(id) => view.concepts.get(id.split("/")[0])}
        onAnswer={(i, choice) => {
          const c = (course.challenges ?? [])[i];
          if (c && choice !== null) judge(choice === c.answerIndex);
          save((s) => {
            const answers = [...(s.challenge[stage] ?? [])];
            answers[i] = choice;
            return { ...s, challenge: { ...s.challenge, [stage]: answers } };
          });
        }}
        onRewatch={(conceptId) => go(view.introIndex(conceptId))}
        onContinue={next}
      />
    );
  } else if (block.kind === "clip") {
    const span = view.spans.get(block.spanId)!;
    const prevClip = view.clipIndex(index, -1);
    const nextClip = view.clipIndex(index, 1);
    body = (
      <ClipView
        key={index}
        objective={view.objective(block.objectiveId)!}
        span={span}
        video={course.videos[span.videoId]}
        part={partOf(timeline, index)}
        upNext={describe(timeline[index + 1], view, course)}
        onEnded={() => save((s) => (s.watched.includes(span.id) ? s : { ...s, watched: [...s.watched, span.id] }))}
        onContinue={next}
        onPrevClip={prevClip >= 0 ? () => go(prevClip) : undefined}
        onNextClip={nextClip >= 0 ? () => go(nextClip) : undefined}
      />
    );
  } else if (block.kind === "check") {
    const item = view.items.get(block.itemId) as CheckItem;
    const altSpan = view.alternate(block.objectiveId);
    const altItem = view.checks(block.objectiveId).find((i) => i.id !== item.id) as CheckItem | undefined;
    // Aimed at the wrong pick: the server picks the alternate clip that clears up its misconception.
    const target = async (asked: CheckItem, choice: number) => {
      const res = await fetch(`/api/courses/${course.slug}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: asked.id, choice }),
      });
      if (!res.ok) return undefined;
      const r = (await res.json()) as { spanId: string; focus: string; item: CheckItem };
      const span = view.spans.get(r.spanId);
      return span && { span, video: course.videos[span.videoId], item: r.item, focus: r.focus };
    };
    body = (
      <CheckView
        key={index}
        item={item}
        target={altSpan ? target : undefined}
        alternate={altSpan && altItem ? { span: altSpan, video: course.videos[altSpan.videoId], item: altItem } : undefined}
        answered={learner.answered.includes(key)}
        onAnswer={(asked, choice, confidence, unaided) => {
          judge(choice === asked.answerIndex);
          save((s) => markAnswered(withAnswer(s, asked, choice, confidence, unaided)));
        }}
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
    const objectives = mod.conceptIds.flatMap((id) => view.concepts.get(id)?.objectives ?? []).filter((o) => chosen(o.id));
    body = (
      <TeachbackView
        key={index}
        slug={course.slug}
        module={mod}
        objectives={objectives}
        misconceptions={learner.attempts.flatMap((a) => (a.misconception && objectives.some((o) => o.id === a.objectiveId) ? [a.misconception] : []))}
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
        onAnswer={(item, choice, confidence) => {
          judge(choice === item.answerIndex);
          save((s) => withAnswer(s, item, choice, confidence, true));
        }}
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
        onAnswer={(item, choice, confidence) => {
          judge(choice === item.answerIndex);
          save((s) => withAnswer(s, item, choice, confidence, true));
        }}
        onFinish={(score) => save((s) => ({ ...s, quizScores: { ...s.quizScores, [key]: score } }))}
        onContinue={next}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <InkWash mood={mood} />
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <Mark size={28} />
          <span>Shifu</span>
        </Link>
        <span className={styles.topic}>{course.plan.topic}</span>
        <ThemeToggle className={styles.headerToggle} />
        <button className={styles.mapButton} onClick={() => setMap({})}>
          <MapIcon /> Mind map
        </button>
      </header>
      {map && (
        <MapDialog
          view={view}
          learner={learner}
          pending={pending}
          added={added}
          focusId={map.focus}
          currentConceptId={concept?.id}
          building={!!build}
          onSelect={(id) => {
            setMap(null);
            go(view.introIndex(id));
          }}
          onClose={() => setMap(null)}
        />
      )}
      <div className={styles.layout}>
        <aside className={styles.left}>
          <Progression
            merged={merged}
            view={view}
            learner={learner}
            index={index}
            pending={learner.overlay.concepts
              .filter((c) => pending.has(c.id))
              .map((c) => ({ concept: c, before: learner.overlay.links.find((l) => l.prerequisiteId === c.id)?.conceptId }))}
            onGo={go}
          />
        </aside>
        <main className={styles.main}>
          <GoalLine view={view} learner={learner} onJump={(id) => go(view.introIndex(id))} />
          <section className={styles.mapBand} aria-label="Mind map">
            <div className={styles.mapBandHead}>
              <p className={styles.eyebrow}>Mind map</p>
              <button className={styles.link} onClick={() => setMap({})}>
                Expand
              </button>
            </div>
            <MindMap
              variant="band"
              plan={course.plan}
              states={view.objectiveStates(learner)}
              available={view.available}
              building={!!build}
              pending={pending}
              added={added}
              currentConceptId={concept?.id}
              onSelect={(id) => go(view.introIndex(id))}
            />
          </section>
          {build && <BuildBanner slug={course.slug} progress={build} />}
          <div className={styles.track} aria-label={`Step ${Math.min(index + 1, timeline.length)} of ${timeline.length}`}>
            <span style={{ width: `${(Math.min(index, timeline.length) / timeline.length) * 100}%` }} />
          </div>
          <div className={styles.lesson} data-lesson="">
            {body}
          </div>
          {index > 0 && block && (
            <button className={styles.back} onClick={() => go(index - 1)}>
              ← Back
            </button>
          )}
        </main>
      </div>
      <Thread from={`.${styles.left} [data-current]`} to="[data-lesson] > section" index={index} />
      <Coach
        shared={shared}
        merged={merged}
        view={view}
        learner={learner}
        index={index}
        conceptId={concept?.id}
        objectiveId={block && (block.kind === "clip" || block.kind === "check") ? block.objectiveId : undefined}
        go={go}
      />
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
