"use client";

// The path (docs/design.md, "The path"): the whole course laid out as a strip below the lesson.
// Chapters across the top; under them every concept with its parts, each clip a thumbnail with
// what it teaches, and the checks, cards and quizzes between. The learner can see where they are,
// what is coming, and what the coach is adding for them as it lands.

import { useEffect, useRef } from "react";
import { clock, type CourseView } from "@/lib/course-view";
import type { LearnerState } from "@/lib/learner";
import type { Merged } from "@/lib/overlay";
import type { Block, Concept } from "@/lib/types";
import { Seal } from "../mark";
import styles from "./path.module.css";

const cx = (...names: (string | false | undefined | null)[]) => names.filter(Boolean).join(" ");

interface Item {
  index: number;
  key: string;
  block: Block;
}

/** One card in the strip: a concept with its blocks, or a block that stands alone (quiz, teach-back, challenge). */
interface Group {
  id: string;
  title: string;
  concept?: Concept;
  moduleIndex?: number;
  items: Item[];
  /** The coach is still building this concept: on the path, nothing to play yet. */
  pending?: boolean;
}

/** Concepts the coach is building, and the concept each one will come before. */
export interface PendingConcept {
  concept: Concept;
  before?: string;
}

export function groupPath(merged: Merged, view: CourseView, pending: PendingConcept[]): Group[] {
  const { timeline } = merged.course;
  const groups: Group[] = [];
  let open: Group | null = null;
  const standalone = (id: string, title: string, item: Item, moduleIndex?: number) => {
    groups.push({ id, title, items: [item], moduleIndex });
    open = null;
  };
  timeline.forEach((block, index) => {
    const item = { index, key: merged.keys[index], block };
    if (block.kind === "intro") {
      const concept = view.concepts.get(block.conceptId);
      open = { id: block.conceptId, title: concept?.title ?? block.conceptId, concept, moduleIndex: concept?.moduleIndex, items: [item] };
      groups.push(open);
    } else if (block.kind === "challenge") standalone(`challenge-${block.stage}`, block.stage === "before" ? "Goal challenge" : "Goal challenge, again", item);
    else if (block.kind === "teachback") standalone(`teachback-${block.moduleIndex}`, "Teach it back", item, block.moduleIndex);
    else if (block.kind === "quiz") standalone(`quiz-${block.moduleIndex}`, "Chapter quiz", item, block.moduleIndex);
    else if (open) open.items.push(item);
    else {
      open = { id: `start-${index}`, title: "To begin", items: [item] };
      groups.push(open);
    }
  });
  // A concept still being built sits where it will land: before the concept that needs it.
  for (const p of pending) {
    const group: Group = { id: p.concept.id, title: p.concept.title, concept: p.concept, moduleIndex: p.concept.moduleIndex, items: [], pending: true };
    const at = p.before ? groups.findIndex((g) => g.id === p.before) : -1;
    groups.splice(at < 0 ? groups.length : at, 0, group);
  }
  return groups;
}

export function Path(props: {
  merged: Merged;
  view: CourseView;
  learner: LearnerState;
  index: number;
  pending: PendingConcept[];
  onGo: (index: number) => void;
}) {
  const { merged, view, learner, index } = props;
  const course = merged.course;
  const groups = groupPath(merged, view, props.pending);
  const strip = useRef<HTMLOListElement>(null);

  // Keep the current block in view as the lesson moves on.
  useEffect(() => {
    const el = strip.current;
    const target = el?.querySelector<HTMLElement>("[data-current]");
    if (!el || !target) return;
    const left = target.offsetLeft - el.clientWidth / 2 + target.offsetWidth / 2;
    el.scrollTo({ left, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [index, groups.length]);

  const currentGroup = groups.find((g) => g.items.some((i) => i.index === index));
  const currentModule = currentGroup?.moduleIndex ?? view.conceptAt(index)?.moduleIndex;
  const toChapter = (moduleIndex: number) => {
    const group = groups.find((g) => g.moduleIndex === moduleIndex && g.items.length);
    if (group) props.onGo(group.items[0].index);
  };
  const attempt = (itemId: string) => learner.attempts.findLast((a) => a.itemId === itemId);

  return (
    <nav className={styles.path} aria-label="Your path">
      <ol className={styles.chapters}>
        {course.plan.modules.map((m) => {
          const concepts = m.conceptIds.map((id) => view.concepts.get(id)).filter((c): c is Concept => !!c && view.available.has(c.id));
          const studied = concepts.filter((c) => view.studied(learner, c)).length;
          const on = m.index === currentModule;
          return (
            <li key={m.index}>
              <button
                className={cx(styles.chapter, on && styles.chapterOn)}
                style={{ ["--p" as string]: concepts.length ? studied / concepts.length : 0 }}
                onClick={() => toChapter(m.index)}
                disabled={!groups.some((g) => g.moduleIndex === m.index && g.items.length)}
                aria-current={on ? "true" : undefined}
              >
                <span className={styles.chapterN}>{m.index + 1}</span>
                <span className={styles.chapterTitle}>{m.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <ol className={styles.strip} ref={strip}>
        {groups.map((g) => {
          const on = g === currentGroup;
          const intro = g.items[0]?.block.kind === "intro" ? g.items[0] : undefined;
          const parts = g.items.filter((i) => i.block.kind !== "intro");
          let clipN = 0;
          return (
            <li key={g.id} className={cx(styles.group, styles.fresh, on && styles.groupOn, g.pending && styles.groupPending)}>
              <div className={styles.groupHead}>
                {intro ? (
                  <button className={styles.groupTitle} onClick={() => props.onGo(intro.index)} aria-current={index === intro.index ? "step" : undefined} data-current={index === intro.index ? "" : undefined}>
                    {g.title}
                  </button>
                ) : (
                  <span className={styles.groupTitle}>{g.title}</span>
                )}
                {g.concept && (
                  <span className={styles.dots} aria-hidden="true">
                    {g.concept.objectives.map((o) => (
                      <span key={o.id} className={cx(styles.dot, styles[`dot_${view.objectiveState(learner, o.id)}`])} />
                    ))}
                  </span>
                )}
              </div>
              {g.pending ? (
                <p className={styles.building}>
                  <span className={styles.buildingBar} aria-hidden="true" />
                  Finding the videos
                </p>
              ) : (
                <ol className={styles.parts}>
                  {parts.map((item) => {
                    const b = item.block;
                    const isOn = item.index === index;
                    const passed = item.index < index;
                    const common = { "data-current": isOn ? "" : undefined, "aria-current": isOn ? ("step" as const) : undefined };
                    if (b.kind === "clip") {
                      clipN += 1;
                      const span = view.spans.get(b.spanId);
                      const video = span && course.videos[span.videoId];
                      const watched = !!span && learner.watched.includes(span.id);
                      return (
                        <li key={item.key} className={styles.fresh}>
                          <button className={cx(styles.part, isOn && styles.partOn, passed && styles.partPassed)} onClick={() => props.onGo(item.index)} {...common}>
                            <span className={styles.thumb}>
                              {video && <Thumb videoId={video.id} />}
                              <span className={styles.partN}>{isOn ? <Playing /> : clipN}</span>
                              {span && <span className={styles.len}>{clock(span.end - span.start)}</span>}
                              {watched && <Seal size={18} className={styles.watched} label="Watched" />}
                            </span>
                            <span className={styles.partText}>{view.objective(b.objectiveId)?.text}</span>
                            {video && <span className={styles.partChannel}>{video.channel}</span>}
                          </button>
                        </li>
                      );
                    }
                    if (b.kind === "intro") return null;
                    const glyph = glyphFor(b, item.key, learner, attempt, view);
                    return (
                      <li key={item.key} className={styles.fresh}>
                        <button
                          className={cx(styles.glyph, glyph.className, isOn && styles.glyphOn, passed && !glyph.className && styles.glyphPassed)}
                          onClick={() => props.onGo(item.index)}
                          title={glyph.label}
                          aria-label={glyph.label}
                          {...common}
                        >
                          {glyph.icon}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function glyphFor(
  b: Exclude<Block, { kind: "clip" | "intro" }>,
  key: string,
  learner: LearnerState,
  attempt: (itemId: string) => { correct: boolean } | undefined,
  view: CourseView,
): { icon: React.ReactNode; label: string; className?: string } {
  switch (b.kind) {
    case "check": {
      const a = learner.answered.includes(key) ? attempt(b.itemId) : undefined;
      return { icon: a ? (a.correct ? <Check /> : <Cross />) : "?", label: a ? (a.correct ? "Check: right" : "Check: wrong") : "Check", className: a && (a.correct ? styles.glyphRight : styles.glyphWrong) };
    }
    case "practice": {
      const score = learner.quizScores[key];
      return { icon: score ? `${score.correct}/${score.total}` : "+", label: "Practice questions the coach added", className: cx(styles.glyphAdded, score && styles.glyphScored) };
    }
    case "cards":
      return { icon: <Cards />, label: "Flashcards", className: b.itemIds.every((id) => learner.cards[id]) ? styles.glyphDone : undefined };
    case "quiz": {
      const score = learner.quizScores[key];
      return { icon: score ? `${score.correct}/${score.total}` : "Q", label: "Chapter quiz", className: score && styles.glyphScored };
    }
    case "teachback": {
      const graded = view.course.plan.modules.find((m) => m.index === b.moduleIndex)?.conceptIds.some((id) => view.concepts.get(id)?.objectives.some((o) => learner.objectives[o.id]?.confirmed));
      return { icon: <Mic />, label: "Teach it back", className: graded ? styles.glyphDone : undefined };
    }
    case "challenge": {
      const score = view.challengeScore(learner, b.stage);
      return { icon: score ? `${score.right}/${score.of}` : <Flag />, label: b.stage === "before" ? "Goal challenge" : "Goal challenge, again", className: score && styles.glyphScored };
    }
  }
}

/** YouTube's own still for the video: an image, not the video. */
function Thumb({ videoId }: { videoId: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a fixed-size still from YouTube's image CDN
  return <img src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`} alt="" loading="lazy" decoding="async" />;
}

function Playing() {
  return (
    <span className={styles.playing} aria-label="Now playing">
      <i />
      <i />
      <i />
    </span>
  );
}

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Cross = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const Cards = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
    <rect x="1.5" y="4" width="9" height="9.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 1.5 H12 A1.5 1.5 0 0 1 13.5 3 V10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const Mic = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="4.5" y="1" width="5" height="7.5" rx="2.5" fill="currentColor" />
    <path d="M2.5 6.5 A4.5 4.5 0 0 0 11.5 6.5 M7 11 V13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const Flag = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 13 V1.5 M3 2 H11 L9 5 L11 8 H3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
