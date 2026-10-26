// Step 1 of the build pipeline (PLAN.md §6): Muse Spark designs the course structure. The model's
// output is normalised here, so a bad id, a forward prerequisite or an oversized plan can't reach
// the rest of the pipeline.

import { z } from "zod";
import { generate, type Usage } from "../models/router";
import type { Concept, CoursePlan, Level, Module } from "../types";

export interface PlanInput {
  topic: string;
  goal: string;
  level: Level;
  minutesPerDay: number;
}

const LIMITS = { modules: 4, conceptsPerModule: 4, objectives: 3, mustInclude: 4, queries: 3 };

export const PlanOutput = z.object({
  modules: z.array(
    z.object({
      title: z.string(),
      concepts: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          why: z.string(),
          prerequisites: z.array(z.string()),
          objectives: z.array(z.object({ text: z.string(), mustInclude: z.array(z.string()) })),
          searchQueries: z.array(z.string()),
        }),
      ),
    }),
  ),
});
export type PlanOutput = z.infer<typeof PlanOutput>;

/** About four days of daily sessions, kept between half an hour and an hour and a half. */
export const targetMinutes = (minutesPerDay: number) => Math.min(90, Math.max(30, Math.round(minutesPerDay * 4)));

export const PLAN_SYSTEM = `You design short video courses. Each course is built from the best moments of existing YouTube videos: for every learning objective you write, a later step finds the 1-4 minute stretch of a video that teaches it. Your job is the structure.

Rules:
- 2-4 modules, each with 2-4 concepts, in teaching order. Fewer is better than padding.
- Concept ids are short kebab-case and unique. "prerequisites" lists the ids of earlier concepts this one directly builds on.
- "why": one sentence, at most 20 words, on why the concept matters for the learner's goal.
- 1-3 objectives per concept. Each starts with a verb (explain, compute, compare, predict, identify, ...) and names something the learner can do or explain afterwards. Each must be teachable by one short clip.
- "mustInclude": 2-4 short, specific points a good explanation of that objective has to contain. They are used to judge clips, so make them checkable.
- "searchQueries": 2-3 YouTube searches that would find a focused explanation of this concept, not of the whole topic, in the plain words people actually search with.
- Fit the learner's level and goal; skip what their level implies they already know.
- No medical, legal or financial advice.`;

export const planPrompt = (input: PlanInput) =>
  [
    `Topic: ${input.topic}`,
    `Goal: ${input.goal}`,
    `Level: ${input.level}`,
    `Length: about ${targetMinutes(input.minutesPerDay)} minutes of video in total.`,
  ].join("\n");

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "concept";

const clean = (xs: string[], max: number) => xs.map((x) => x.trim()).filter(Boolean).slice(0, max);

/** "Module 2: Basics" / "2. Basics" → "Basics": the app numbers modules itself. */
const unnumber = (title: string) => title.trim().replace(/^(module\s*)?\d+\s*[.):\-–]\s*/i, "");

/**
 * Model output → CoursePlan. Ids become unique slugs; prerequisites may only point at earlier
 * concepts; empty concepts and modules are dropped; lists are capped. Returns what it changed.
 */
export function toCoursePlan(input: PlanInput, out: PlanOutput): { plan: CoursePlan; warnings: string[] } {
  const warnings: string[] = [];
  const idMap = new Map<string, string>();
  const used = new Set<string>();
  const seen = new Set<string>();
  const modules: Module[] = [];
  const concepts: Concept[] = [];

  if (out.modules.length > LIMITS.modules) warnings.push(`kept ${LIMITS.modules} of ${out.modules.length} modules`);
  for (const m of out.modules.slice(0, LIMITS.modules)) {
    const index = modules.length;
    const conceptIds: string[] = [];
    for (const c of m.concepts.slice(0, LIMITS.conceptsPerModule)) {
      const objectives = c.objectives
        .map((o) => ({ text: o.text.trim(), mustInclude: clean(o.mustInclude, LIMITS.mustInclude) }))
        .filter((o) => o.text)
        .slice(0, LIMITS.objectives);
      if (!objectives.length) {
        warnings.push(`dropped "${c.title}": no objectives`);
        continue;
      }

      let id = slug(c.id || c.title);
      for (let n = 2; used.has(id); n++) id = `${slug(c.id || c.title)}-${n}`;
      used.add(id);
      idMap.set(c.id, id);

      const prerequisites: string[] = [];
      for (const p of c.prerequisites) {
        const target = idMap.get(p);
        if (target && seen.has(target) && !prerequisites.includes(target)) prerequisites.push(target);
        else warnings.push(`dropped prerequisite "${p}" of "${id}": not an earlier concept`);
      }

      const queries = clean(c.searchQueries, LIMITS.queries);
      concepts.push({
        id,
        moduleIndex: index,
        title: c.title.trim(),
        why: c.why.trim(),
        prerequisites,
        objectives: objectives.map((o, i) => ({ id: `${id}/${i + 1}`, conceptId: id, ...o })),
        searchQueries: queries.length ? queries : [`${c.title} ${input.topic}`],
      });
      conceptIds.push(id);
      seen.add(id);
    }
    if (conceptIds.length) modules.push({ index, title: unnumber(m.title), conceptIds });
    else warnings.push(`dropped module "${m.title}": no concepts`);
  }

  return {
    plan: { topic: input.topic, goal: input.goal, level: input.level, minutesPerDay: input.minutesPerDay, modules, concepts },
    warnings,
  };
}

export async function planCourse(input: PlanInput): Promise<{ plan: CoursePlan; warnings: string[]; usage: Usage; model: string }> {
  const out = await generate("plan", { name: "CoursePlan", schema: PlanOutput, system: PLAN_SYSTEM, user: planPrompt(input) });
  if (!out.data.modules.length) throw new Error("The planner returned no modules");
  return { ...toCoursePlan(input, out.data), usage: out.usage, model: `${out.provider}/${out.model}` };
}
