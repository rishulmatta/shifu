"use client";

// The coach (PLAN.md §3, "The course coach"): a window over the lesson where the learner says what
// they need and the course changes to fit. Every reply comes with a card showing the change and
// where it lands in their path: questions inserted after where they are, or a new prerequisite
// concept growing in front of the one that needs it. The controls under each clip and question
// open the window with a precise request (ask.ts). Additions go into the learner's own overlay.

import { useEffect, useRef, useState } from "react";
import type { CoachEvent } from "@/app/api/courses/[slug]/coach/route";
import type { CourseView } from "@/lib/course-view";
import { type CoachChange, type LearnerState, update } from "@/lib/learner";
import { applyPatch, dropConcept, mergeCourse, type Merged, type OverlayPatch } from "@/lib/overlay";
import type { BuildStep } from "@/lib/store";
import type { Block, CheckItem, Course } from "@/lib/types";
import { Mark } from "../mark";
import { COACH_EVENT, type CoachRequest, showOnMap } from "./ask";
import { ChangeCard } from "./change-card";
import styles from "./coach.module.css";

const STEPS: BuildStep[] = ["finding", "captions", "clips", "questions"];

interface Props {
  shared: Course;
  merged: Merged;
  view: CourseView;
  learner: LearnerState;
  index: number;
  conceptId?: string;
  /** The objective of the clip or question on screen, when there is one. */
  objectiveId?: string;
  go: (position: number) => void;
}

export function Coach(props: Props) {
  const { learner } = props;
  const slug = props.shared.slug;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);
  // Stream events and control requests arrive after renders: they act on the latest course and
  // position, not the ones captured when the request was made.
  const latest = useRef({ props, open, busy });
  useEffect(() => {
    latest.current = { props, open, busy };
  });

  const toggle = (next: boolean) => {
    setOpen(next);
    if (next) setUnseen(false);
  };

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const lastStatus = learner.coach.at(-1)?.change?.status;
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [learner.coach.length, lastStatus, open]);

  useEffect(() => {
    const onAsk = (e: Event) => {
      toggle(true);
      if (!latest.current.busy) void send((e as CustomEvent<CoachRequest>).detail);
    };
    window.addEventListener(COACH_EVENT, onAsk);
    return () => window.removeEventListener(COACH_EVENT, onAsk);
    // send and toggle read the latest state through refs and the learner store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = (from: "learner" | "coach", message: string, change?: CoachChange) =>
    update(slug, (s) => ({ ...s, coach: [...s.coach, { from, text: message, ...(change && { change }) }].slice(-40) }));

  // One request is in flight at a time, so the change being reported is the latest coach turn's.
  const setChange = (patch: Partial<CoachChange>) => {
    update(slug, (s) => {
      const last = s.coach.findLastIndex((t) => t.from === "coach");
      return { ...s, coach: s.coach.map((t, i) => (i === last && t.change ? { ...t, change: { ...t.change, ...patch } } : t)) };
    });
    if (patch.status && patch.status !== "working" && !latest.current.open) setUnseen(true);
  };

  /** Adds blocks after the block keyed `after`, keeping the learner on the block they're on. */
  const place = (patch: OverlayPatch, after: string) => {
    let goTo: string | undefined;
    update(slug, (s) => {
      const overlay = applyPatch(s.overlay, patch, after);
      const before = mergeCourse(latest.current.props.shared, s.overlay).keys;
      const anchor = after === "^" ? -1 : before.indexOf(after);
      const shift = patch.blocks?.length && anchor < s.position ? patch.blocks.length : 0;
      if (patch.blocks?.length) goTo = `x${overlay.insertions.length - 1}:0`;
      return { ...s, overlay, position: s.position + shift };
    });
    return goTo;
  };

  /** The block just before a concept's intro: a new prerequisite goes there, so it comes first. */
  const anchorBefore = (conceptId?: string) => {
    const { merged, view } = latest.current.props;
    const intro = conceptId ? view.introIndex(conceptId) : -1;
    return intro > 0 ? merged.keys[intro - 1] : "^";
  };

  const skip = (): CoachChange => {
    const { view, index, merged, conceptId, go } = latest.current.props;
    const next = merged.course.timeline.findIndex((b, i) => i > index && b.kind === "intro" && b.conceptId !== conceptId);
    if (next < 0) return { kind: "skip", status: "failed", note: "This is the last concept." };
    go(next);
    return { kind: "skip", status: "done", note: `Moved on to ${view.conceptAt(next)?.title}` };
  };

  /** Changes the browser makes straight away. */
  const actNow = (a: Extract<CoachEvent, { type: "reply" }>["action"]): CoachChange | undefined => {
    const { view, index, merged, go } = latest.current.props;
    if (a.kind === "skip") return skip();
    if (a.kind === "goto") {
      const intro = view.introIndex(a.conceptId);
      if (intro < 0) return { kind: "goto", status: "failed", note: "There's nothing to watch there yet." };
      go(intro);
      return { kind: "goto", status: "done", note: `Moved to ${view.concepts.get(a.conceptId)?.title}` };
    }
    if (a.kind === "reexplain") {
      const span = view.alternate(a.objectiveId);
      const item = view.checks(a.objectiveId)[1] as CheckItem | undefined;
      if (!span || !item) return { kind: "reexplain", status: "failed", note: "There's no second explanation of this one yet." };
      const blocks: Block[] = [
        { kind: "clip", objectiveId: a.objectiveId, spanId: span.id },
        { kind: "check", objectiveId: a.objectiveId, itemId: item.id },
      ];
      const goTo = place({ blocks }, merged.keys[index] ?? "^");
      return { kind: "reexplain", status: "done", note: `${merged.course.videos[span.videoId]?.channel ?? "Another creator"} explains it next`, goTo };
    }
    return undefined;
  };

  async function send(request: CoachRequest) {
    const p = latest.current.props;
    const after = p.merged.keys[p.index] ?? p.merged.keys.at(-1) ?? "^";
    setText("");
    say("learner", request.text);
    if (request.local === "skip") {
      const change = skip();
      say("coach", change.status === "done" ? "Skipped ahead. The quiz at the end of the module will still check it." : "There's nothing after this to skip to.", change);
      return;
    }

    setBusy(true);
    const o = p.learner.overlay;
    const built = o.concepts.filter((c) => p.view.available.has(c.id));
    const asked: Record<string, string[]> = {};
    for (const i of o.items) if (i.kind === "mcq") (asked[i.objectiveId] ??= []).push(i.prompt);
    const body = {
      message: request.text,
      intent: request.intent,
      history: p.learner.coach.slice(-8).map((t) => ({ from: t.from, text: t.text.slice(0, 800) })),
      conceptId: p.conceptId,
      states: p.view.objectiveStates(p.learner),
      misconceptions: p.learner.attempts
        .filter((a) => a.misconception)
        .slice(-5)
        .map((a) => ({ objectiveId: a.objectiveId, text: a.misconception!.slice(0, 300) })),
      added: { concepts: built, links: o.links.filter((l) => built.some((c) => c.id === l.prerequisiteId)), spans: o.spans, asked },
    };

    let growing: string | undefined;
    try {
      const res = await fetch(`/api/courses/${slug}/coach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok || !res.body) {
        say("coach", (await res.json().catch(() => null))?.error ?? "The coach didn't answer. Try again in a moment.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const e = JSON.parse(line) as CoachEvent;
          if (e.type === "reply") {
            const a = e.action;
            if (a.kind === "practice") say("coach", e.text, { kind: "practice", status: "working", note: "Writing questions", count: a.count });
            else if (a.kind === "prerequisite") {
              growing = a.concept.id;
              const before = latest.current.props.view.concepts.get(a.before)?.title;
              say("coach", e.text, { kind: "prerequisite", status: "working", note: "Finding videos", concept: { id: a.concept.id, title: a.concept.title }, before, step: 0 });
              place({ concept: a.concept, before: a.before }, after);
            } else say("coach", e.text, actNow(a));
          } else if (e.type === "progress") {
            const step = e.step ? STEPS.indexOf(e.step) : -1;
            setChange({ note: e.text.replace(/ for .*$/, ""), ...(step >= 0 && { step }) });
          } else if (e.type === "patch") {
            const at = e.patch.concept ? anchorBefore(e.patch.before) : after;
            const goTo = place(e.patch, at);
            const note = e.patch.concept ? "Added to your path" : `${e.patch.items?.length ?? 0} questions added`;
            setChange({ status: "done", note, goTo, count: e.patch.concept ? undefined : e.patch.items?.length });
            growing = undefined;
          } else if (e.type === "failed") {
            setChange({ status: "failed", note: e.text });
            if (growing) update(slug, (s) => ({ ...s, overlay: dropConcept(s.overlay, growing!) }));
            growing = undefined;
          }
        }
      }
    } catch {
      say("coach", "The connection dropped. Try again in a moment.");
      if (growing) update(slug, (s) => ({ ...s, overlay: dropConcept(s.overlay, growing!) }));
    } finally {
      setBusy(false);
    }
  }

  const jump = (key: string) => {
    const at = props.merged.keys.indexOf(key);
    if (at >= 0) props.go(at);
  };

  const objective = props.objectiveId;
  const suggestions: CoachRequest[] = objective
    ? [
        { text: "More practice on this", intent: { kind: "practice", objectiveId: objective } },
        { text: "I'm missing the basics", intent: { kind: "basics", objectiveId: objective } },
        { text: "Explain it differently" },
        { text: "Skip, I know this", local: "skip" },
      ]
    : [{ text: "Ask me more questions" }, { text: "Explain the basics first" }, { text: "Skip, I know this", local: "skip" }];
  const working = busy || lastStatus === "working";

  return (
    <>
      {open && (
        <section className={styles.window} role="dialog" aria-modal="false" aria-labelledby="coach-title" onKeyDown={(e) => e.key === "Escape" && toggle(false)}>
          <header className={styles.head}>
            <span className={styles.headMark}>
              <Mark size={26} />
            </span>
            <div>
              <h2 id="coach-title" className={styles.title}>
                Coach
              </h2>
              <p className={styles.sub}>Changes your course to fit you</p>
            </div>
            <button className={styles.close} onClick={() => toggle(false)} aria-label="Close the coach">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 6 L8 10.5 L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>

          <ol ref={list} className={styles.turns} aria-live="polite">
            {learner.coach.length === 0 && (
              <li className={styles.empty}>
                <p>Tell me what you need: more practice, the basics behind an idea, or a different explanation.</p>
                <p className={styles.muted}>I change your course to fit, and show you where each change lands.</p>
              </li>
            )}
            {learner.coach.map((t, i) =>
              t.from === "learner" ? (
                <li key={i} className={styles.mine}>
                  {t.text}
                </li>
              ) : (
                <li key={i} className={styles.theirs}>
                  <p>{t.text}</p>
                  {t.change && (
                    <ChangeCard
                      change={t.change}
                      here={props.view.concepts.get(props.conceptId ?? "")?.title}
                      onStart={t.change.goTo ? () => jump(t.change!.goTo!) : undefined}
                      onShowMap={t.change.concept && t.change.status === "done" ? () => showOnMap(t.change!.concept!.id) : undefined}
                    />
                  )}
                </li>
              ),
            )}
            {busy && learner.coach.at(-1)?.from === "learner" && (
              <li className={`${styles.theirs} ${styles.muted}`}>
                <span className={styles.spinner} aria-hidden="true" /> Thinking
              </li>
            )}
          </ol>

          <footer className={styles.foot}>
            <div className={styles.suggestions}>
              {suggestions.map((s) => (
                <button key={s.text} className={styles.chip} disabled={busy} onClick={() => send(s)}>
                  {s.text}
                </button>
              ))}
            </div>
            <form
              className={styles.ask}
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim() && !busy) void send({ text: text.trim() });
              }}
            >
              <input
                ref={input}
                className={styles.input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What do you need?"
                maxLength={500}
                disabled={busy}
                aria-label="Message the coach"
              />
              <button className={styles.send} disabled={busy || !text.trim()} aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M9 14.5 V3.5 M4.5 8 L9 3.5 L13.5 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </footer>
        </section>
      )}

      <button
        className={`${styles.launcher} ${open ? styles.launcherOpen : ""} ${working ? styles.launcherWorking : ""}`}
        onClick={() => toggle(!open)}
        aria-expanded={open}
        aria-label={open ? "Close the coach" : "Open the coach"}
      >
        <span className={`${styles.seal} ${working ? styles.sealWorking : ""}`}>
          <Mark size={30} />
        </span>
        <span className={styles.launcherText}>Coach</span>
        {unseen && <span className={styles.badge} aria-label="A change is ready" />}
      </button>
    </>
  );
}
