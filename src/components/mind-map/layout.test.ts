import { describe, expect, it } from "vitest";
import { bayesCourse } from "@/lib/fixtures/bayes";
import type { CoursePlan } from "@/lib/types";
import { layoutMap, wrap } from "./layout";

const concept = (id: string, moduleIndex: number, prerequisites: string[] = []) => ({
  id,
  moduleIndex,
  title: id,
  why: "",
  prerequisites,
  objectives: [{ id: `${id}/1`, conceptId: id, text: "", mustInclude: [] }],
  searchQueries: [],
});

const plan: CoursePlan = {
  ...bayesCourse.plan,
  modules: [
    { index: 0, title: "Basics", conceptIds: ["a", "b"] },
    { index: 1, title: "Next", conceptIds: ["c"] },
  ],
  concepts: [concept("a", 0), concept("b", 0, ["a"]), concept("c", 1, ["a", "b", "missing"])],
};

describe("layoutMap", () => {
  it("puts modules in columns left to right and stacks their concepts in plan order", () => {
    const l = layoutMap(plan, "horizontal");
    const [a, b, c] = ["a", "b", "c"].map((id) => l.nodes.find((n) => n.id === id)!);
    expect(a.x).toBe(b.x);
    expect(a.y).toBeLessThan(b.y);
    expect(c.x).toBeGreaterThan(a.x);
    expect(c.y).toBe((a.y + b.y) / 2);
    expect(l.modules.map((m) => m.title)).toEqual(["Basics", "Next"]);
  });

  it("turns modules into rows when vertical, concepts side by side within the width", () => {
    const l = layoutMap(plan, "vertical", 300);
    const [a, b, c] = ["a", "b", "c"].map((id) => l.nodes.find((n) => n.id === id)!);
    expect(a.y).toBe(b.y);
    expect(a.x).toBeLessThan(b.x);
    expect(c.y).toBeGreaterThan(a.y);
    expect(l.width).toBe(300);
    expect(Math.max(...l.nodes.map((n) => n.x))).toBeLessThan(300);
  });

  it("draws one line per known prerequisite, marking those within a module", () => {
    const l = layoutMap(plan, "horizontal");
    expect(l.edges.map((e) => `${e.from}>${e.to}:${e.within}`)).toEqual(["a>b:true", "a>c:false", "b>c:false"]);
  });

  it("joins neighbours in a module with a straight line that starts below the label", () => {
    const l = layoutMap(plan, "horizontal");
    const [a] = l.nodes;
    const ab = l.edges.find((e) => e.from === "a" && e.to === "b")!;
    expect(ab.path).toMatch(/^M [\d.]+ [\d.]+ L /);
    expect(Number(ab.path.split(" ")[2])).toBeGreaterThan(a.y + l.labelOffset);
  });

  it("adds a line under concepts that carry a note", () => {
    const l = layoutMap(plan, "horizontal", 320, new Set(["c"]));
    expect(l.nodes.find((n) => n.id === "c")!.lines).toEqual(["c", ""]);
  });

  it("lays out the sample course", () => {
    const l = layoutMap(bayesCourse.plan, "horizontal");
    expect(l.nodes).toHaveLength(bayesCourse.plan.concepts.length);
    expect(l.edges.length).toBeGreaterThan(0);
  });
});

describe("wrap", () => {
  it("breaks a title into lines that fit, with an ellipsis past the last", () => {
    expect(wrap("Bayes' rule", 100, 7)).toEqual(["Bayes' rule"]);
    expect(wrap("The medical test paradox explained", 84, 7)).toEqual(["The medical", "test paradox", "explained"]);
    expect(wrap("one two three four five six seven", 49, 7, 2)).toEqual(["one two", "three…"]);
  });
});
