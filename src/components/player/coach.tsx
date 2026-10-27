"use client";

// The coach panel (PLAN.md §3, "The course coach"): the learner says what they need and the course
// changes to fit. Every reply comes with the change it made: practice questions up next, a new
// prerequisite concept (its node grows into the mind map while it builds), the idea from another
// creator, or a jump. Additions go into the learner's own overlay; the shared course never changes.

import { useEffect, useRef, useState } from "react";
import type { CoachEvent } from "@/app/api/courses/[slug]/coach/route";
import type { CourseView } from "@/lib/course-view";
import { type CoachTurn, type LearnerState, update } from "@/lib/learner";
import { applyPatch, dropConcept, mergeCourse, type Merged, type OverlayPatch } from "@/lib/overlay";
import type { Block, CheckItem, Course } from "@/lib/types";
import styles from "./player.module.css";

const SUGGESTIONS = ["Ask me more questions", "Explain the basics first", "Explain this differently", "I know this, skip ahead"];

interface Props {
  shared: Course;
  merged: Merged;
  view: CourseView;
  learner: LearnerState;
  index: number;
  conceptId?: string;
  go: (position: number) => void;
}

export function CoachPanel(props: Props) {
  const { learner } = props;
  const slug = props.shared.slug;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  // Stream events arrive after renders; they act on the latest course and position, not the ones
  // captured when the message was sent.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  const lastStatus = learner.coach.at(-1)?.change?.status;
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [learner.coach.length, lastStatus]);

  // One message is in flight at a time, so the change being reported is the latest coach turn's.
  const setChange = (change: CoachTurn["change"]) =>
    update(slug, (s) => {
      const last = s.coach.findLastIndex((t) => t.from === "coach");
      return { ...s, coach: s.coach.map((t, i) => (i === last ? { ...t, change } : t)) };
    });

  /** Adds blocks after the block keyed `after`, keeping the learner on the block they're on. */
  const place = (patch: OverlayPatch, after: string) => {
    let goTo: string | undefined;
    update(slug, (s) => {
      const overlay = applyPatch(s.overlay, patch, after);
      const before = mergeCourse(latest.current.shared, s.overlay).keys;
      const anchor = after === "^" ? -1 : before.indexOf(after);
      const shift = patch.blocks?.length && anchor < s.position ? patch.blocks.length : 0;
      if (patch.blocks?.length) goTo = `x${overlay.insertions.length - 1}:0`;
      return { ...s, overlay, position: s.position + shift };
    });
    return goTo;
  };

  async function send(message: string) {
    const p = latest.current;
    const after = p.merged.keys[p.index] ?? p.merged.keys.at(-1) ?? "^";
    setBusy(true);
    setText("");
    update(slug, (s) => ({ ...s, coach: [...s.coach, { from: "learner" as const, text: message }].slice(-40) }));

    const o = p.learner.overlay;
    const built = o.concepts.filter((c) => p.view.available.has(c.id));
    const asked: Record<string, string[]> = {};
    for (const i of o.items) if (i.kind === "mcq") (asked[i.objectiveId] ??= []).push(i.prompt);
    const body = {
      message,
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
    const coachSays = (reply: string, change?: CoachTurn["change"]) =>
      update(slug, (s) => ({ ...s, coach: [...s.coach, { from: "coach" as const, text: reply, ...(change && { change }) }].slice(-40) }));

    try {
      const res = await fetch(`/api/courses/${slug}/coach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok || !res.body) {
        const error = (await res.json().catch(() => null))?.error;
        coachSays(error ?? "I couldn't reach the coach just now. Try again in a moment.");
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
            if (a.kind === "practice") coachSays(e.text, { status: "working", note: "Writing questions…" });
            else if (a.kind === "prerequisite") {
              growing = a.concept.id;
              coachSays(e.text, { status: "working", note: `Building "${a.concept.title}"…` });
              place({ concept: a.concept, before: a.before }, after);
            } else coachSays(e.text, actNow(a));
          } else if (e.type === "progress") {
            setChange({ status: "working", note: e.text });
          } else if (e.type === "patch") {
            const at = e.patch.concept ? anchorBefore(e.patch.before) : after;
            const goTo = place(e.patch, at);
            const note = e.patch.concept
              ? `Added "${e.patch.concept.title}" before ${latest.current.view.concepts.get(e.patch.before ?? "")?.title ?? "this concept"}`
              : `Added ${e.patch.items?.length ?? 0} questions, up next`;
            setChange({ status: "done", note, goTo });
            growing = undefined;
          } else if (e.type === "failed") {
            setChange({ status: "failed", note: e.text });
            if (growing) update(slug, (s) => ({ ...s, overlay: dropConcept(s.overlay, growing!) }));
            growing = undefined;
          }
        }
      }
    } catch {
      coachSays("The connection dropped. Try again in a moment.");
      if (growing) update(slug, (s) => ({ ...s, overlay: dropConcept(s.overlay, growing!) }));
    } finally {
      setBusy(false);
    }
  }

  /** The block just before a concept's intro: a new prerequisite goes there, so it comes first. */
  function anchorBefore(conceptId?: string) {
    const { merged, view } = latest.current;
    const intro = conceptId ? view.introIndex(conceptId) : -1;
    return intro > 0 ? merged.keys[intro - 1] : "^";
  }

  /** Changes the browser can make straight away, with the coach's note on what happened. */
  function actNow(a: Extract<CoachEvent, { type: "reply" }>["action"]): CoachTurn["change"] | undefined {
    const { view, index, merged, conceptId } = latest.current;
    if (a.kind === "goto") {
      const intro = view.introIndex(a.conceptId);
      if (intro < 0) return { status: "failed", note: "There's nothing to watch there yet." };
      props.go(intro);
      return { status: "done", note: `Went to ${view.concepts.get(a.conceptId)?.title}` };
    }
    if (a.kind === "skip") {
      const next = merged.course.timeline.findIndex((b, i) => i > index && b.kind === "intro" && b.conceptId !== conceptId);
      if (next < 0) return { status: "failed", note: "This is the last concept." };
      props.go(next);
      return { status: "done", note: `Skipped ahead to ${view.conceptAt(next)?.title}` };
    }
    if (a.kind === "reexplain") {
      const span = view.alternate(a.objectiveId);
      const item = view.checks(a.objectiveId)[1] as CheckItem | undefined;
      if (!span || !item) return { status: "failed", note: "There's no second explanation of this one yet." };
      const blocks: Block[] = [
        { kind: "clip", objectiveId: a.objectiveId, spanId: span.id },
        { kind: "check", objectiveId: a.objectiveId, itemId: item.id },
      ];
      const goTo = place({ blocks }, merged.keys[index] ?? "^");
      return { status: "done", note: `Up next: the same idea from ${merged.course.videos[span.videoId]?.channel ?? "another creator"}`, goTo };
    }
    return undefined;
  }

  const jump = (key: string) => {
    const at = props.merged.keys.indexOf(key);
    if (at >= 0) props.go(at);
  };

  return (
    <section className={styles.coach} aria-label="Coach">
      <p className={styles.eyebrow}>Your coach</p>
      {learner.coach.length === 0 && <p className={styles.coachIntro}>Tell Shifu what you need, and it reshapes your course to fit.</p>}
      {learner.coach.length > 0 && (
        <ol ref={list} className={styles.turns} aria-live="polite">
          {learner.coach.map((t, i) => (
            <li key={i} className={t.from === "learner" ? styles.mine : styles.theirs}>
              <p>{t.text}</p>
              {t.change && (
                <p className={`${styles.change} ${styles[`change_${t.change.status}`]}`}>
                  <span aria-hidden="true">{t.change.status === "done" ? "✓" : t.change.status === "failed" ? "✕" : <span className={styles.spinner} />}</span>
                  <span>{t.change.note}</span>
                  {t.change.goTo && t.change.status === "done" && (
                    <button className={styles.link} onClick={() => jump(t.change!.goTo!)}>
                      Start
                    </button>
                  )}
                </p>
              )}
            </li>
          ))}
          {busy && learner.coach.at(-1)?.from === "learner" && (
            <li className={styles.theirs}>
              <p className={styles.muted}>
                <span className={styles.spinner} /> Thinking…
              </p>
            </li>
          )}
        </ol>
      )}
      <div className={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <button key={s} className={styles.chip} disabled={busy} onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>
      <form
        className={styles.ask}
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim() && !busy) send(text.trim());
        }}
      >
        <input
          className={styles.askInput}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What do you need?"
          maxLength={500}
          disabled={busy}
          aria-label="Message the coach"
        />
        <button className={styles.primary} disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
