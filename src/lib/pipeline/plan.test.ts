import { describe, expect, it } from "vitest";
import { type PlanOutput, targetMinutes, toCoursePlan } from "./plan";

const input = { topic: "Bayes' theorem", goal: "understand it", level: "beginner", minutesPerDay: 20 } as const;
const concept = (id: string, prerequisites: string[] = [], objectives = 1) => ({
  id,
  title: `Title of ${id}`,
  why: "  because  ",
  prerequisites,
  objectives: Array.from({ length: objectives }, (_, i) => ({ text: `Explain ${id} ${i}`, mustInclude: ["a", " ", "b"] })),
  searchQueries: [`${id} explained`],
});

describe("toCoursePlan", () => {
  it("numbers objectives, indexes modules and trims text", () => {
    const out: PlanOutput = { modules: [{ title: " One ", concepts: [concept("priors", [], 2)] }] };
    const { plan, warnings } = toCoursePlan(input, out);
    expect(warnings).toEqual([]);
    expect(plan.modules).toEqual([{ index: 0, title: "One", conceptIds: ["priors"] }]);
    expect(plan.concepts[0].objectives.map((o) => o.id)).toEqual(["priors/1", "priors/2"]);
    expect(plan.concepts[0].objectives[0].mustInclude).toEqual(["a", "b"]);
    expect(plan.concepts[0].why).toBe("because");
  });

  it("removes numbering the model added to module titles", () => {
    const titles = ["2. Basics", "Module 3: Odds", "Module 1 - Intro", "10) Wrap-up", "3D shapes"];
    const out: PlanOutput = { modules: titles.map((title, i) => ({ title, concepts: [concept(`c${i}`)] })) };
    expect(toCoursePlan(input, out).plan.modules.map((m) => m.title)).toEqual(["Basics", "Odds", "Intro", "Wrap-up"]);
  });

  it("slugs ids and keeps them unique", () => {
    const out: PlanOutput = { modules: [{ title: "M", concepts: [concept("Bayes Rule!"), concept("bayes-rule")] }] };
    expect(toCoursePlan(input, out).plan.concepts.map((c) => c.id)).toEqual(["bayes-rule", "bayes-rule-2"]);
  });

  it("keeps only prerequisites that come earlier, following renamed ids", () => {
    const out: PlanOutput = {
      modules: [
        { title: "M1", concepts: [concept("Priors"), concept("rule", ["Priors", "later", "rule"])] },
        { title: "M2", concepts: [concept("later", ["rule"])] },
      ],
    };
    const { plan, warnings } = toCoursePlan(input, out);
    expect(plan.concepts.find((c) => c.id === "rule")?.prerequisites).toEqual(["priors"]);
    expect(plan.concepts.find((c) => c.id === "later")?.prerequisites).toEqual(["rule"]);
    expect(warnings).toHaveLength(2);
  });

  it("drops concepts without objectives and modules without concepts", () => {
    const out: PlanOutput = {
      modules: [
        { title: "Empty", concepts: [concept("hollow", [], 0)] },
        { title: "Real", concepts: [concept("solid")] },
      ],
    };
    const { plan, warnings } = toCoursePlan(input, out);
    expect(plan.modules).toEqual([{ index: 0, title: "Real", conceptIds: ["solid"] }]);
    expect(plan.concepts[0].moduleIndex).toBe(0);
    expect(warnings).toHaveLength(2);
  });

  it("caps modules, concepts and objectives", () => {
    const many = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => concept(`${prefix}${i}`, [], 5));
    const out: PlanOutput = { modules: Array.from({ length: 6 }, (_, m) => ({ title: `M${m}`, concepts: many(6, `m${m}c`) })) };
    const { plan } = toCoursePlan(input, out);
    expect(plan.modules).toHaveLength(4);
    expect(plan.modules.every((m) => m.conceptIds.length === 4)).toBe(true);
    expect(plan.concepts.every((c) => c.objectives.length === 3)).toBe(true);
  });
});

describe("targetMinutes", () => {
  it("is about four days of sessions, between 30 and 90 minutes", () => {
    expect(targetMinutes(5)).toBe(30);
    expect(targetMinutes(15)).toBe(60);
    expect(targetMinutes(60)).toBe(90);
  });
});
