"use client";

// The mind map (PLAN.md §3): every concept of the course and the prerequisites between them, each
// ringed by how well the learner knows its objectives. Drawn as SVG from layoutMap; nodes pop in
// as they appear (so a concept added later grows into the map), prerequisite lines draw on, and a
// line flows once the concept it starts from is solid.

import { useEffect, useId, useRef, useState } from "react";
import { conceptState } from "@/lib/mastery";
import type { Concept, ConceptId, CoursePlan, MasteryState, ObjectiveId } from "@/lib/types";
import { layoutMap, wrap, type MapLayout, type MapNode, type Orientation } from "./layout";
import styles from "./mind-map.module.css";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

const STATE_LABEL: Record<MasteryState, string> = { new: "not started", learning: "learning", shaky: "shaky", solid: "solid" };

/** Below this width the full map turns on its side: modules top to bottom. */
const NARROW = 640;

export function MindMap(props: {
  plan: CoursePlan;
  states: Record<ObjectiveId, MasteryState>;
  /** Concepts with something to play; the rest are drawn dashed. All of them when absent. */
  available?: Set<ConceptId>;
  /** Whether unavailable concepts are still being built (otherwise no good clip was found). */
  building?: boolean;
  currentConceptId?: ConceptId;
  onSelect?: (conceptId: ConceptId) => void;
  /** compact: always vertical, sized to its container (the progress panel). full: the big map. */
  variant?: "compact" | "full";
}) {
  const { plan, states, available, currentConceptId, variant = "full" } = props;
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const orientation: Orientation = variant === "compact" || (width !== null && width < NARROW) ? "vertical" : "horizontal";
  const isOpen = (id: ConceptId) => !available || available.has(id);
  const closed = new Set(plan.concepts.filter((c) => !isOpen(c.id)).map((c) => c.id));
  const layout = layoutMap(plan, orientation, width ?? 320, closed);
  const concepts = new Map(plan.concepts.map((c) => [c.id, c]));
  const stateOf = (c: Concept) => conceptState(c.objectives.map((o) => states[o.id] ?? "new"));
  const numbers = new Map(layout.nodes.map((n, i) => [n.id, i + 1]));

  return (
    <div ref={box} className={cx(styles.map, styles[variant])}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        className={styles.svg}
        role="group"
        aria-label={`Mind map of ${plan.topic}: ${layout.nodes.length} concepts`}
      >
        <defs>
          <pattern id={`dots-${uid}`} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" className={styles.dot} />
          </pattern>
          {(["muted", "solid"] as const).map((tone) => (
            <marker key={tone} id={`arrow-${tone}-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" className={styles[`arrow_${tone}`]} />
            </marker>
          ))}
        </defs>
        {variant === "full" && <rect width={layout.width} height={layout.height} fill={`url(#dots-${uid})`} />}

        {layout.modules.map((m) => (
          <ModuleLabel key={m.index} layout={layout} index={m.index} title={m.title} x={m.x} y={m.y} />
        ))}

        {layout.edges.map((e, i) => {
          const from = concepts.get(e.from)!;
          const flowing = stateOf(from) === "solid";
          const pending = !isOpen(e.to) || !isOpen(e.from);
          return (
            <g key={`${e.from}>${e.to}`} className={styles.edge} style={{ animationDelay: `${200 + i * 70}ms` }}>
              <path
                d={e.path}
                pathLength={1}
                className={cx(styles.line, flowing && styles.lineSolid, pending && styles.linePending)}
                markerEnd={`url(#arrow-${flowing ? "solid" : "muted"}-${uid})`}
              />
              {flowing && <path d={e.path} className={styles.flow} />}
            </g>
          );
        })}

        {layout.nodes.map((n) => {
          const concept = concepts.get(n.id)!;
          const open = isOpen(n.id);
          const state = stateOf(concept);
          const current = n.id === currentConceptId;
          const solid = concept.objectives.filter((o) => states[o.id] === "solid").length;
          const select = open && props.onSelect ? () => props.onSelect!(n.id) : undefined;
          const label = `${concept.title}: ${open ? `${STATE_LABEL[state]}, ${solid} of ${concept.objectives.length} objectives solid` : props.building ? "still building" : "no good clip found"}${current ? ", you are here" : ""}`;
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <g
                className={cx(styles.node, select && styles.clickable, !open && styles.closed)}
                style={{ animationDelay: `${(numbers.get(n.id)! - 1) * 70}ms` }}
                role={select ? "button" : "img"}
                tabIndex={select ? 0 : undefined}
                aria-label={label}
                aria-current={current ? "step" : undefined}
                onClick={select}
                onKeyDown={(ev) => {
                  if (select && (ev.key === "Enter" || ev.key === " ")) {
                    ev.preventDefault();
                    select();
                  }
                }}
              >
                <title>{label}</title>
                {current && <circle r={layout.radius + 13} className={styles.halo} />}
                <circle r={layout.radius} className={cx(styles.face, styles[`face_${open ? state : "new"}`], current && styles.faceCurrent)} />
                <Ring radius={layout.radius} states={concept.objectives.map((o) => (open ? (states[o.id] ?? "new") : "new"))} />
                <text className={styles.number} dy="0.35em">
                  {state === "solid" && open ? "✓" : numbers.get(n.id)}
                </text>
                <Label layout={layout} node={n} note={open ? undefined : props.building ? "building…" : "no clip found"} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** One arc per objective around the node, coloured by its state, with small gaps between. */
function Ring({ radius, states }: { radius: number; states: MasteryState[] }) {
  const gap = states.length > 1 ? 14 : 0;
  const span = 360 / states.length;
  return (
    <>
      {states.map((s, i) => (
        <path key={i} d={arc(radius, i * span + gap / 2, (i + 1) * span - gap / 2)} className={cx(styles.segment, styles[`seg_${s}`])} />
      ))}
    </>
  );
}

function arc(r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 359.9) return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}`;
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M ${point(startDeg)} A ${r} ${r} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${point(endDeg)}`;
}

function Label({ layout, node, note }: { layout: MapLayout; node: MapNode; note?: string }) {
  const lines = note ? [...node.lines.slice(0, -1), note] : node.lines;
  return (
    <text y={layout.labelOffset} className={cx(styles.label, layout.orientation === "vertical" && styles.labelSmall)}>
      {lines.map((l, i) => (
        <tspan key={i} x="0" dy={i === 0 ? 0 : layout.lineHeight} className={note && i === lines.length - 1 ? styles.note : undefined}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function ModuleLabel(props: { layout: MapLayout; index: number; title: string; x: number; y: number }) {
  const vertical = props.layout.orientation === "vertical";
  const lines = vertical ? [props.title] : wrap(props.title, 180, 7.6, 2);
  return (
    <text x={props.x} y={props.y} className={cx(styles.module, vertical && styles.moduleStart)}>
      <tspan className={styles.moduleIndex}>Module {props.index + 1}</tspan>
      {vertical ? (
        <tspan dx="8">{wrap(props.title, props.layout.width - 90, 6.4, 1)[0]}</tspan>
      ) : (
        lines.map((l, i) => (
          <tspan key={i} x={props.x} dy={i === 0 ? "1.35em" : "1.2em"} className={styles.moduleTitle}>
            {l}
          </tspan>
        ))
      )}
    </text>
  );
}
