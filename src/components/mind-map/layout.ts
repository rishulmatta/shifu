// Where each concept of the mind map goes (PLAN.md §3). Pure, so the drawing stays simple and the
// tests can pin the layout down. Horizontal: one column per module, left to right, concepts stacked
// in plan order. Vertical (narrow screens and the progress panel): one row per module, top to
// bottom, concepts side by side.

import type { ConceptId, CoursePlan } from "@/lib/types";

export type Orientation = "horizontal" | "vertical";

export interface MapNode {
  id: ConceptId;
  moduleIndex: number;
  /** Position within its module, from 0. */
  order: number;
  x: number;
  y: number;
  /** The title, wrapped to fit under the node. */
  lines: string[];
}

export interface MapEdge {
  from: ConceptId;
  to: ConceptId;
  /** SVG path from the prerequisite to the concept that builds on it. */
  path: string;
  /** Both ends in the same module. */
  within: boolean;
}

export interface MapModule {
  index: number;
  title: string;
  x: number;
  y: number;
}

export interface MapLayout {
  orientation: Orientation;
  width: number;
  height: number;
  radius: number;
  /** How far below a node's centre its label's first line sits, and the gap between lines. */
  labelOffset: number;
  lineHeight: number;
  nodes: MapNode[];
  edges: MapEdge[];
  modules: MapModule[];
}

const H = { radius: 30, colW: 210, rowH: 172, header: 70, padX: 64, padBottom: 8, labelOffset: 58, lineHeight: 15.6, charW: 7.4, maxLines: 3 };
const V = { radius: 24, rowH: 156, header: 28, arc: 30, padX: 12, padBottom: 4, labelOffset: 44, lineHeight: 13.2, charW: 6.2, maxLines: 2 };

/** Splits a title into at most `maxLines` lines that fit `width` at roughly `charW` per character. */
export function wrap(text: string, width: number, charW: number, maxLines = 3): string[] {
  const max = Math.max(6, Math.floor(width / charW));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, max - 1).trimEnd()}…`;
  return kept;
}

/**
 * `notes`: concepts that get one more line under the title (the map writes "building…" there).
 */
export function layoutMap(plan: CoursePlan, orientation: Orientation, width = 320, notes: ReadonlySet<ConceptId> = new Set()): MapLayout {
  const modules = [...plan.modules].sort((a, b) => a.index - b.index);
  const titles = new Map(plan.concepts.map((c) => [c.id, c.title]));
  const columns = modules.map((m) => m.conceptIds.filter((id) => titles.has(id)));
  const nodes: MapNode[] = [];
  const placed: MapModule[] = [];
  const k = orientation === "horizontal" ? H : V;
  let size: { width: number; height: number };

  const lines = (id: ConceptId, labelWidth: number) => {
    const wrapped = wrap(titles.get(id)!, labelWidth, k.charW, k.maxLines);
    return notes.has(id) ? [...wrapped, ""] : wrapped;
  };

  if (orientation === "horizontal") {
    const rows = Math.max(1, ...columns.map((c) => c.length));
    columns.forEach((ids, col) => {
      const x = H.padX + col * H.colW + H.colW / 2;
      placed.push({ index: modules[col].index, title: modules[col].title, x, y: 18 });
      const offset = ((rows - ids.length) * H.rowH) / 2;
      ids.forEach((id, order) =>
        nodes.push({ id, moduleIndex: modules[col].index, order, x, y: H.header + offset + order * H.rowH + H.radius + 14, lines: lines(id, 170) }),
      );
    });
    size = { width: H.padX * 2 + columns.length * H.colW, height: H.header + rows * H.rowH + H.padBottom };
  } else {
    const widest = Math.max(1, ...columns.map((c) => c.length));
    const inner = width - V.padX * 2;
    const labelWidth = Math.min(inner / widest - 8, 150);
    columns.forEach((ids, row) => {
      const top = row * V.rowH;
      placed.push({ index: modules[row].index, title: modules[row].title, x: V.padX, y: top + 16 });
      const y = top + V.header + V.arc + V.radius;
      ids.forEach((id, order) =>
        nodes.push({ id, moduleIndex: modules[row].index, order, x: V.padX + (inner * (order + 0.5)) / ids.length, y, lines: lines(id, labelWidth) }),
      );
    });
    size = { width, height: columns.length * V.rowH + V.padBottom };
  }

  const base = { orientation, ...size, radius: k.radius, labelOffset: k.labelOffset, lineHeight: k.lineHeight };
  const at = new Map(nodes.map((n) => [n.id, n]));
  const links = plan.concepts.flatMap((c) =>
    c.prerequisites.flatMap((pre) => {
      const from = at.get(pre);
      const to = at.get(c.id);
      return from && to && from !== to ? [{ from, to }] : [];
    }),
  );
  // Lines between modules arrive on one side of a column (or row) and leave on the other; an arc
  // inside a module goes round whichever side the fewest of them use.
  const across = (id: ConceptId, dir: "in" | "out") =>
    links.filter((l) => l.from.moduleIndex !== l.to.moduleIndex && (dir === "in" ? l.to.id === id : l.from.id === id)).length;

  const edges: MapEdge[] = links.map(({ from, to }) => {
    const within = from.moduleIndex === to.moduleIndex;
    const freeBefore = across(from.id, "in") + across(to.id, "in") <= across(from.id, "out") + across(to.id, "out");
    return { from: from.id, to: to.id, within, path: edgePath(base, from, to, within, freeBefore, size) };
  });

  return { ...base, nodes, edges, modules: placed };
}

type Frame = Pick<MapLayout, "orientation" | "radius" | "labelOffset" | "lineHeight">;

/** Below a node's label, where a line leaving downwards can start without crossing it. */
const underLabel = (l: Frame, n: MapNode) => n.y + l.labelOffset + (n.lines.length - 1) * l.lineHeight + 10;

/**
 * Neighbours in a module are joined by a short straight arrow; longer jumps inside a module arc
 * round the free side (`freeBefore`: left of a column, above a row); lines between modules curve
 * across, bowing outward when they skip a module so they pass beside its concepts, not through.
 */
function edgePath(l: Frame, a: MapNode, b: MapNode, within: boolean, freeBefore: boolean, size: { width: number; height: number }): string {
  const r = l.radius + 6;
  const step = Math.abs(b.order - a.order);
  const down = b.order > a.order ? 1 : -1;
  if (l.orientation === "horizontal") {
    if (within && step === 1 && down === 1) return `M ${a.x} ${underLabel(l, a)} L ${b.x} ${b.y - r}`;
    if (within) {
      const side = freeBefore ? -1 : 1;
      const bulge = 46 + 18 * step;
      return `M ${a.x + side * r} ${a.y} C ${a.x + side * (r + bulge)} ${a.y}, ${b.x + side * (r + bulge)} ${b.y}, ${b.x + side * r} ${b.y}`;
    }
    const dx = (b.x - a.x) / 2;
    const bow = skips(a, b) ? (a.y + b.y > size.height ? 70 : -70) : 0;
    return `M ${a.x + r} ${a.y} C ${a.x + r + dx} ${a.y + bow}, ${b.x - r - dx} ${b.y + bow}, ${b.x - r} ${b.y}`;
  }
  if (within && step === 1) return `M ${a.x + down * r} ${a.y} L ${b.x - down * r} ${b.y}`;
  if (within) {
    const lift = 22 + 4 * step;
    return `M ${a.x} ${a.y - r} C ${a.x} ${a.y - r - lift}, ${b.x} ${b.y - r - lift}, ${b.x} ${b.y - r}`;
  }
  const startY = underLabel(l, a);
  const dy = (b.y - r - startY) / 2;
  const bow = skips(a, b) ? (a.x + b.x > size.width ? 1 : -1) * 0.22 * size.width : 0;
  return `M ${a.x} ${startY} C ${a.x + bow} ${startY + dy}, ${b.x + bow} ${b.y - r - dy}, ${b.x} ${b.y - r}`;
}

const skips = (a: MapNode, b: MapNode) => Math.abs(b.moduleIndex - a.moduleIndex) > 1;
