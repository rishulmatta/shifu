"use client";

// The progression (docs/design.md, "The progression"): the whole course as one brush stroke down
// the left of the lesson. Chapters are seals on the stroke, concepts hang their parts off it, and
// the ink reaches exactly as far as the learner has come; the rest is a dry guide still to walk.
// Whatever the coach or the build adds later stamps itself on in its place.

import { useEffect, useId, useRef, useState } from "react";
import { clock, type CourseView } from "@/lib/course-view";
import type { LearnerState } from "@/lib/learner";
import type { Merged } from "@/lib/overlay";
import { groupPath, type PathGroup, type PathItem, type PendingConcept } from "@/lib/path";
import type { Block, Challenge, Concept } from "@/lib/types";
import { Seal } from "../mark";
import styles from "./progression.module.css";

const cx = (...names: (string | false | undefined | null)[]) => names.filter(Boolean).join(" ");

/** Where the stroke runs, in px from the left of the column: the centre of every node marker. */
const SPINE = 40;

export function Progression(props: {
  merged: Merged;
  view: CourseView;
  learner: LearnerState;
  index: number;
  pending: PendingConcept[];
  onGo: (index: number) => void;
}): React.JSX.Element {
  const { merged, view, learner, index, onGo } = props;
  const course = merged.course;
  const groups = groupPath(merged, view, props.pending);
  const nav = useRef<HTMLElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const [height, setHeight] = useState(0);
  const filterId = `brush${useId().replace(/[^\w-]/g, "")}`;
  const done = index >= course.timeline.length;

  // The stroke is drawn to the rail's height, so it follows whatever lands on it.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setHeight(el.offsetHeight);
      inkTo(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // As the lesson moves on, the ink follows and the column scrolls the current node into view,
  // inside the column only, so the page itself never jumps.
  useEffect(() => {
    const box = nav.current;
    const el = rail.current;
    if (!box || !el) return;
    const y = inkTo(el);
    if (y === undefined) return;
    const top = el.offsetTop + y - box.clientHeight * 0.38;
    box.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [index, groups.length]);

  const currentGroup = groups.find((g) => g.items.some((i) => i.index === index));
  const currentModule = currentGroup?.moduleIndex ?? view.conceptAt(index)?.moduleIndex;
  const attempt = (itemId: string) => learner.attempts.findLast((a) => a.itemId === itemId);

  // Chapters land on the stroke where their first group does; a chapter still being built waits
  // at the end of the ones before it.
  const rows: React.ReactNode[] = [];
  const shown = new Set<number>();
  const chapter = (moduleIndex: number) => {
    const m = course.plan.modules.find((x) => x.index === moduleIndex);
    if (!m || shown.has(m.index)) return;
    shown.add(m.index);
    const concepts = m.conceptIds.map((id) => view.concepts.get(id)).filter((c): c is Concept => !!c && view.available.has(c.id));
    const studied = concepts.filter((c) => view.studied(learner, c)).length;
    const on = m.index === currentModule;
    rows.push(
      <li key={`chapter-${m.index}`} className={cx(styles.row, styles.chapter, styles.fresh, on && styles.chapterOn)} data-row="">
        <span className={styles.chapterSeal} data-marker="" aria-hidden="true">
          {m.index + 1}
        </span>
        <span className={styles.chapterText}>
          <span className={styles.chapterTitle}>
            <span className={styles.srOnly}>Chapter {m.index + 1}: </span>
            {m.title}
          </span>
          <span className={styles.chapterMeta}>{concepts.length ? `${studied} of ${concepts.length} studied` : "Being built"}</span>
        </span>
      </li>,
    );
  };
  const before = (moduleIndex: number) => {
    for (const m of course.plan.modules) if (m.index < moduleIndex && !shown.has(m.index)) chapter(m.index);
    chapter(moduleIndex);
  };

  for (const g of groups) {
    if (g.moduleIndex !== undefined) before(g.moduleIndex);
    rows.push(
      <GroupRows
        key={g.id}
        group={g}
        index={index}
        view={view}
        learner={learner}
        course={course}
        onGo={onGo}
        attempt={attempt}
      />,
    );
  }
  if (course.status !== "ready") for (const m of course.plan.modules) chapter(m.index);

  return (
    <nav className={styles.progression} aria-label="Your progression" ref={nav}>
      <ol className={styles.rail} ref={rail} data-done={done ? "" : undefined} style={{ ["--spine" as string]: `${SPINE}px` }}>
        {height > 0 && <Stroke height={height} filterId={filterId} />}
        {rows}
      </ol>
    </nav>
  );
}

/**
 * Moves the end of the ink to the current node (or the whole way, once the course is done) and
 * returns where that is, in px from the top of the rail.
 */
function inkTo(rail: HTMLElement): number | undefined {
  const current = rail.querySelector<HTMLElement>("[data-current]");
  let y: number | undefined;
  if (current) {
    const marker = current.closest("[data-row]")?.querySelector<HTMLElement>("[data-marker]") ?? current;
    y = topIn(marker, rail) + marker.offsetHeight / 2;
  } else if (rail.dataset.done !== undefined) y = rail.offsetHeight;
  rail.style.setProperty("--ink-to", `${y ?? 0}px`);
  return y;
}

/** Offset of `el` from the top of `root`, through the offset parents (transforms don't count). */
function topIn(el: HTMLElement, root: HTMLElement) {
  let y = 0;
  let e: HTMLElement | null = el;
  while (e && e !== root) {
    y += e.offsetTop;
    e = e.offsetParent as HTMLElement | null;
  }
  return y;
}

/**
 * One brush stroke the height of the rail: the brush lands heavy at the top with a slight splay,
 * runs even with a hand's wobble, thins a little as it goes, and lifts off dry at the bottom.
 */
function brushPath(h: number) {
  const top = 4;
  const bottom = Math.max(top + 40, h - 10);
  const len = bottom - top;
  const width = (y: number) => {
    const d = y - top;
    const rest = bottom - y;
    // Heavy and a little splayed where it lands, an even body that thins slowly, a long dry lift.
    let w = d < 56 ? 16 - 5.5 * (d / 56) ** 0.6 : 10.5 - 2.5 * Math.min(1, (d - 56) / Math.max(1, len - 56));
    if (rest < 140) w *= 0.1 + 0.9 * (rest / 140) ** 0.8;
    return w;
  };
  const centre = (y: number) => {
    const d = y - top;
    return SPINE + 1.3 * Math.sin(y / 47) + 0.8 * Math.sin(y / 131 + 2) - (d < 32 ? 1.6 * (1 - d / 32) : 0);
  };
  const left: string[] = [];
  const right: string[] = [];
  for (let y = top; ; y = Math.min(bottom, y + 6)) {
    const x = centre(y);
    const w = width(y) / 2;
    left.push(`${(x - w).toFixed(1)} ${y.toFixed(1)}`);
    right.push(`${(x + w).toFixed(1)} ${y.toFixed(1)}`);
    if (y >= bottom) break;
  }
  const cap = width(top) / 2;
  return `M${left.join("L")}L${right.reverse().join("L")}A${cap.toFixed(1)} ${(cap * 0.8).toFixed(1)} 0 0 0 ${left[0]}Z`;
}

function Stroke({ height, filterId }: { height: number; filterId: string }) {
  const d = brushPath(height);
  const x = SPINE + 1.3 * Math.sin(height / 47);
  return (
    <li className={styles.strokeItem} aria-hidden="true">
      <svg className={styles.guide} width={SPINE * 2} height={height} viewBox={`0 0 ${SPINE * 2} ${height}`}>
        <path d={d} fill="currentColor" />
      </svg>
      <svg className={styles.ink} width={SPINE * 2} height={height} viewBox={`0 0 ${SPINE * 2} ${height}`}>
        <defs>
          {/* A dry brush: the edges ragged and the body streaked along the stroke. */}
          <filter id={filterId} x="-20%" y="0" width="140%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.55 0.02" numOctaves="2" seed="7" result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="3" xChannelSelector="R" yChannelSelector="G" result="ragged" />
            <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.68" result="streaks" />
            <feComposite in="ragged" in2="streaks" operator="in" />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          <path d={d} fill="currentColor" />
        </g>
        {/* Flecks thrown past the lift: seen only once the whole course is inked. */}
        <circle cx={x + 3} cy={height - 4} r={1.3} fill="currentColor" />
        <circle cx={x - 2.5} cy={height - 1.5} r={0.9} fill="currentColor" />
      </svg>
    </li>
  );
}

function GroupRows(props: {
  group: PathGroup;
  index: number;
  view: CourseView;
  learner: LearnerState;
  course: Merged["course"];
  onGo: (index: number) => void;
  attempt: (itemId: string) => { correct: boolean } | undefined;
}) {
  const { group: g, index, view, learner, course, onGo, attempt } = props;

  if (g.pending) {
    return (
      <li className={cx(styles.row, styles.pendingRow, styles.fresh)} data-row="">
        <span className={styles.pendingMark} data-marker="" aria-hidden="true" />
        <div className={styles.pending} role="status">
          <span className={styles.pendingTitle}>{g.title}</span>
          <span className={styles.sweep} aria-hidden="true" />
          <span className={styles.pendingNote}>Finding the videos</span>
        </div>
      </li>
    );
  }

  // A block that stands alone (goal challenge, teach-back, chapter quiz) is a single node.
  const intro = g.items[0]?.block.kind === "intro" ? g.items[0] : undefined;
  if (!g.concept && g.items.length === 1 && g.items[0].block.kind !== "clip" && !intro) {
    return <Node item={g.items[0]} index={index} view={view} learner={learner} course={course} onGo={onGo} attempt={attempt} clipN={0} standalone />;
  }

  const introOn = !!intro && index === intro.index;
  const clips = g.items.filter((i) => i.block.kind === "clip");
  return (
    <li className={styles.group}>
      <div className={cx(styles.row, styles.concept, styles.fresh, intro && intro.index < index && styles.passed)} data-row="">
        <span className={styles.knot} data-marker="" aria-hidden="true" />
        <span className={styles.conceptText}>
          {intro ? (
            <button
              className={styles.conceptTitle}
              onClick={() => onGo(intro.index)}
              data-current={introOn ? "" : undefined}
              aria-current={introOn ? "step" : undefined}
            >
              {g.title}
            </button>
          ) : (
            <span className={styles.conceptTitle}>{g.title}</span>
          )}
          {g.concept && g.concept.objectives.length > 0 && (
            <span
              className={styles.dots}
              role="img"
              aria-label={`Objectives: ${g.concept.objectives.map((o) => view.objectiveState(learner, o.id)).join(", ")}`}
            >
              {g.concept.objectives.map((o) => {
                const state = view.objectiveState(learner, o.id);
                return <span key={o.id} className={cx(styles.dot, styles[`dot_${state}`])} title={`${o.text}: ${state}`} />;
              })}
            </span>
          )}
        </span>
      </div>
      <ol className={styles.nodes}>
        {g.items.map((item) => {
          if (item.block.kind === "intro") return null;
          const clipN = clips.indexOf(item) + 1;
          return <Node key={item.key} item={item} index={index} view={view} learner={learner} course={course} onGo={onGo} attempt={attempt} clipN={clipN} />;
        })}
      </ol>
    </li>
  );
}

function Node(props: {
  item: PathItem;
  index: number;
  view: CourseView;
  learner: LearnerState;
  course: Merged["course"];
  onGo: (index: number) => void;
  attempt: (itemId: string) => { correct: boolean } | undefined;
  clipN: number;
  standalone?: boolean;
}) {
  const { item, index, view, learner, course, onGo, attempt } = props;
  const b = item.block;
  const on = item.index === index;
  const passed = item.index < index;
  const current = { "data-current": on ? "" : undefined, "aria-current": on ? ("step" as const) : undefined };
  const rowClass = cx(styles.row, styles.node, styles.fresh, props.standalone && styles.standalone, on && styles.on, passed && styles.passed);

  if (b.kind === "clip") {
    const span = view.spans.get(b.spanId);
    const video = span && course.videos[span.videoId];
    const watched = !!span && learner.watched.includes(span.id);
    const objective = view.objective(b.objectiveId)?.text;
    return (
      <li className={rowClass} data-row="">
        <button
          className={styles.nodeButton}
          onClick={() => onGo(item.index)}
          aria-label={`Part ${props.clipN}: ${objective ?? "clip"}${watched ? ", watched" : ""}`}
          {...current}
        >
          <span className={styles.still} data-marker="">
            <span className={styles.frame}>{video && <Thumb videoId={video.id} />}</span>
            <span className={styles.partSeal}>{on ? <Playing /> : props.clipN}</span>
            {span && <span className={styles.len}>{clock(span.end - span.start)}</span>}
            {watched && <Seal size={16} className={styles.watched} />}
          </span>
          <span className={styles.text}>
            <span className={styles.clipText}>{objective}</span>
            {video && <span className={styles.channel}>{video.channel}</span>}
          </span>
        </button>
      </li>
    );
  }
  if (b.kind === "intro") return null;

  const glyph = glyphFor(b, item.key, learner, attempt, view);
  return (
    <li className={rowClass} data-row="">
      <button className={styles.nodeButton} onClick={() => onGo(item.index)} aria-label={glyph.aria} {...current}>
        <span className={cx(styles.mark, glyph.tone && styles[glyph.tone])} data-marker="" aria-hidden="true">
          {glyph.icon}
        </span>
        <span className={styles.text}>
          <span className={styles.label}>{glyph.label}</span>
          {glyph.note && <span className={styles.note}>{glyph.note}</span>}
          {b.kind === "challenge" && <ChallengeDetail stage={b.stage} challenges={course.challenges ?? []} learner={learner} view={view} />}
        </span>
      </button>
    </li>
  );
}

/**
 * Under the goal challenge, revealed as the node is hovered: a dot per question (right, missed,
 * "I don't know yet", or not yet answered) and what the score says.
 */
function ChallengeDetail(props: { stage: "before" | "after"; challenges: Challenge[]; learner: LearnerState; view: CourseView }) {
  const { stage, challenges, learner, view } = props;
  if (!challenges.length) return null;
  const answers = learner.challenge[stage];
  const score = view.challengeScore(learner, stage);
  const before = stage === "after" ? view.challengeScore(learner, "before") : undefined;
  const text = !score
    ? `${challenges.length} questions on your goal, ${stage === "before" ? "answered now and again at the end" : "answered again at the end"}`
    : before && before.right !== score.right
      ? `${score.right} of ${score.of} right, ${score.right > before.right ? "up" : "down"} from ${before.right}`
      : `${score.right} of ${score.of} right`;
  return (
    <span className={styles.detail} aria-hidden="true">
      <span className={styles.detailInner}>
        <span className={styles.qDots}>
          {challenges.map((c, i) => {
            const a = answers?.[i];
            const tone = a === undefined ? styles.qTodo : a === null ? styles.qUnsure : a === c.answerIndex ? styles.qRight : styles.qMiss;
            return <span key={c.id} className={cx(styles.qDot, tone)} style={{ transitionDelay: `${i * 45}ms` }} />;
          })}
        </span>
        <span className={styles.detailText}>{text}</span>
      </span>
    </span>
  );
}

type Tone = "right" | "wrong" | "filled" | "added" | "addedScored";

function glyphFor(
  b: Exclude<Block, { kind: "clip" | "intro" }>,
  key: string,
  learner: LearnerState,
  attempt: (itemId: string) => { correct: boolean } | undefined,
  view: CourseView,
): { icon: React.ReactNode; label: string; note?: string; aria: string; tone?: Tone } {
  switch (b.kind) {
    case "check": {
      const a = learner.answered.includes(key) ? attempt(b.itemId) : undefined;
      const note = a ? (a.correct ? "Right" : "Wrong") : undefined;
      return { icon: a ? (a.correct ? <Check /> : <Cross />) : "?", label: "Check", note, aria: note ? `Check: ${note.toLowerCase()}` : "Check", tone: a && (a.correct ? "right" : "wrong") };
    }
    case "practice": {
      const score = learner.quizScores[key];
      const label = score ? `Practice · ${score.correct}/${score.total}` : "Practice";
      return { icon: score ? `${score.correct}/${score.total}` : "+", label, note: "Added by your coach", aria: `${label}, added by your coach`, tone: score ? "addedScored" : "added" };
    }
    case "cards": {
      const done = b.itemIds.length > 0 && b.itemIds.every((id) => learner.cards[id]);
      const note = done ? "Done" : `${b.itemIds.length} card${b.itemIds.length === 1 ? "" : "s"}`;
      return { icon: <Cards />, label: "Flashcards", note, aria: `Flashcards: ${note.toLowerCase()}`, tone: done ? "filled" : undefined };
    }
    case "quiz": {
      const score = learner.quizScores[key];
      const label = score ? `Chapter quiz · ${score.correct}/${score.total}` : "Chapter quiz";
      return { icon: score ? `${score.correct}/${score.total}` : "Q", label, aria: label, tone: score ? "filled" : undefined };
    }
    case "teachback": {
      const graded = view.course.plan.modules
        .find((m) => m.index === b.moduleIndex)
        ?.conceptIds.some((id) => view.concepts.get(id)?.objectives.some((o) => learner.objectives[o.id]?.confirmed));
      return { icon: <Mic />, label: "Teach it back", note: graded ? "Confirmed" : undefined, aria: graded ? "Teach it back: confirmed" : "Teach it back", tone: graded ? "filled" : undefined };
    }
    case "challenge": {
      const score = view.challengeScore(learner, b.stage);
      const name = b.stage === "before" ? "Goal challenge" : "Goal challenge, again";
      const label = score ? `${name} · ${score.right}/${score.of}` : name;
      return { icon: score ? `${score.right}/${score.of}` : <Flag />, label, aria: label, tone: score ? "filled" : undefined };
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
    <span className={styles.playing} aria-hidden="true">
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
  <svg width="14" height="14" viewBox="0 0 15 15" aria-hidden="true">
    <rect x="1.5" y="4" width="9" height="9.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 1.5 H12 A1.5 1.5 0 0 1 13.5 3 V10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const Mic = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="4.5" y="1" width="5" height="7.5" rx="2.5" fill="currentColor" />
    <path d="M2.5 6.5 A4.5 4.5 0 0 0 11.5 6.5 M7 11 V13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const Flag = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 13 V1.5 M3 2 H11 L9 5 L11 8 H3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
