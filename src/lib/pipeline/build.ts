// The whole build (PLAN.md §6): plan, then module by module find videos, fetch captions, locate,
// verify, choose and write recall, saving after each module so the learner can start on module 1
// while the rest builds. Failures of one video or one objective are recorded and skipped; only a
// failed plan or a course with nothing in it fails the build.

import { addUsage, type Usage, ZERO } from "../models/router";
import { mapSettled } from "../pool";
import type { VideoHit } from "../sources/youtube";
import type { BuildProgress, CourseRecord, Store } from "../store/types";
import type { CaptionLine, Concept, Course, CoursePlan, Objective, RecallItem, Span, Video } from "../types";
import { assembleTimeline } from "./assemble";
import { textInSeconds } from "./captions";
import { chooseSpans } from "./choose";
import { type Candidate, locateInVideo } from "./locate";
import { planCourse, type PlanInput } from "./plan";
import { writeRecall } from "./recall";

export interface Sources {
  search(query: string): Promise<VideoHit[]>;
  embeddable(videoId: string): Promise<boolean>;
  captions(videoId: string): Promise<CaptionLine[] | null>;
}

export const LIMITS = {
  videosPerConcept: 5,
  minDurationS: 180,
  maxDurationS: 2400,
  minCaptionLines: 20,
  parallel: 6,
};

/** Wraps sources with the store's caches, so rebuilding a topic doesn't pay twice. */
export function cached(sources: Sources, store: Store, lang = "en"): Sources {
  return {
    async search(query) {
      const hit = await store.getSearch(query);
      if (hit) return hit;
      const hits = await sources.search(query);
      await store.putSearch(query, hits);
      return hits;
    },
    async embeddable(videoId) {
      const hit = await store.getEmbeddable(videoId);
      if (hit !== undefined) return hit;
      const ok = await sources.embeddable(videoId);
      await store.putEmbeddable(videoId, ok);
      return ok;
    },
    async captions(videoId) {
      const hit = await store.getCaptions(videoId, lang);
      if (hit !== undefined) return hit;
      const lines = await sources.captions(videoId);
      await store.putCaptions(videoId, lang, lines);
      return lines;
    },
  };
}

const videosN = (n: number) => `${n} video${n === 1 ? "" : "s"}`;

/** Candidate videos for a concept: every search query, merged in order, filtered and checked. */
async function findVideos(concept: Concept, sources: Sources, warn: (m: string) => void): Promise<Video[]> {
  const results = await mapSettled(concept.searchQueries, 3, (q) => sources.search(q), (q, e) => warn(`search "${q}" failed: ${String(e)}`));
  const seen = new Set<string>();
  const hits = results
    .flat()
    .filter((h): h is VideoHit => !!h && h.durationS >= LIMITS.minDurationS && h.durationS <= LIMITS.maxDurationS)
    .filter((h) => !seen.has(h.id) && seen.add(h.id));
  const videos: Video[] = [];
  for (const h of hits) {
    if (videos.length === LIMITS.videosPerConcept) break;
    if (await sources.embeddable(h.id).catch(() => false)) videos.push({ id: h.id, title: h.title, channel: h.channel, durationS: h.durationS });
  }
  return videos;
}

export interface BuiltConcepts {
  videos: Video[];
  spans: Span[];
  items: RecallItem[];
  usage: Usage;
}

type Report = (p: Partial<BuildProgress>) => Promise<void>;

function buildModule(plan: CoursePlan, moduleIndex: number, sources: Sources, report: Report, warn: (m: string) => void) {
  return buildConcepts(plan, plan.concepts.filter((c) => c.moduleIndex === moduleIndex), `module ${moduleIndex + 1}`, sources, report, warn);
}

/**
 * Finds videos, reads captions, locates and chooses spans and writes recall for some concepts of a
 * plan: one module of a build, or one prerequisite the coach adds. `label` names them in progress.
 */
export async function buildConcepts(plan: CoursePlan, concepts: Concept[], label: string, sources: Sources, report: Report, warn: (m: string) => void): Promise<BuiltConcepts> {

  await report({ step: "finding", message: `Finding videos for ${label}` });
  const found = await mapSettled(concepts, 3, (c) => findVideos(c, sources, warn), (c, e) => warn(`finding videos for ${c.id} failed: ${String(e)}`));

  // A video found for several concepts is read once, for all of their objectives.
  const byVideo = new Map<string, { video: Video; objectives: Objective[] }>();
  concepts.forEach((c, i) => {
    for (const v of found[i] ?? []) {
      const entry = byVideo.get(v.id) ?? { video: v, objectives: [] };
      entry.objectives.push(...c.objectives);
      byVideo.set(v.id, entry);
    }
  });

  await report({ step: "captions", message: `Reading captions of ${videosN(byVideo.size)} for ${label}` });
  const entries = [...byVideo.values()];
  const captions = await mapSettled(entries, LIMITS.parallel, (e) => sources.captions(e.video.id), (e, err) => warn(`captions for ${e.video.id} failed: ${String(err)}`));
  const withCaptions = entries
    .map((e, i) => ({ ...e, lines: captions[i] }))
    .filter((e): e is typeof e & { lines: CaptionLine[] } => !!e.lines && e.lines.length >= LIMITS.minCaptionLines);

  await report({ step: "clips", message: `Finding the right moments in ${videosN(withCaptions.length)} for ${label}` });
  let usage = ZERO;
  const located = await mapSettled(withCaptions, LIMITS.parallel, (e) => locateInVideo(e.video, e.lines, e.objectives), (e, err) => warn(`locating in ${e.video.id} failed: ${String(err)}`));
  const candidates: Candidate[] = [];
  for (const l of located) {
    if (!l) continue;
    usage = addUsage(usage, l.usage);
    candidates.push(...l.candidates);
  }

  const videos = Object.fromEntries(withCaptions.map((e) => [e.video.id, e.video]));
  const lines = Object.fromEntries(withCaptions.map((e) => [e.video.id, e.lines]));
  const objectives = concepts.flatMap((c) => c.objectives);
  const spans = objectives.flatMap((o) => chooseSpans(o, candidates, videos));

  await report({ step: "questions", message: `Writing and checking questions for ${label}` });
  const clip = (s: Span | undefined) => s && { span: s, text: textInSeconds(lines[s.videoId], s.start, s.end) };
  const withSpans = objectives.filter((o) => spans.some((s) => s.objectiveId === o.id && s.rank === 0));
  const recalls = await mapSettled(
    withSpans,
    LIMITS.parallel,
    (o) => {
      const mine = spans.filter((s) => s.objectiveId === o.id);
      return writeRecall(o, clip(mine.find((s) => s.rank === 0))!, clip(mine.find((s) => s.rank === 1)), plan.context);
    },
    (o, e) => warn(`questions for ${o.id} failed: ${String(e)}`),
  );
  const items: RecallItem[] = [];
  for (const r of recalls) {
    if (!r) continue;
    usage = addUsage(usage, r.usage);
    items.push(...r.items);
  }
  for (const o of objectives) if (!withSpans.includes(o)) warn(`no clip found for "${o.text}"`);

  const used = new Set(spans.map((s) => s.videoId));
  return { videos: Object.values(videos).filter((v) => used.has(v.id)), spans, items, usage };
}

/** Runs the whole build for a course record that already exists in the store. */
export async function buildCourse(slug: string, input: PlanInput, sources: Sources, store: Store): Promise<void> {
  let progress: BuildProgress = { step: "planning", message: "Designing the course", modulesReady: 0, modulesTotal: 0, costUsd: 0, warnings: [] };
  const report = async (patch: Partial<BuildProgress>) => {
    progress = { ...progress, ...patch };
    await store.updateCourse(slug, { progress });
  };
  const warn = (m: string) => {
    progress.warnings = [...progress.warnings, m].slice(-50);
  };

  try {
    await report({});
    const planned = await planCourse(input);
    planned.warnings.forEach(warn);
    const plan = planned.plan;
    const course: Course = { id: slug, slug, status: "building", plan, videos: {}, spans: [], items: [], timeline: [] };
    await store.updateCourse(slug, { course });
    await report({ modulesTotal: plan.modules.length, costUsd: planned.usage.costUsd });

    const built: number[] = [];
    for (const m of plan.modules) {
      const r = await buildModule(plan, m.index, sources, report, warn);
      Object.assign(course.videos, Object.fromEntries(r.videos.map((v) => [v.id, v])));
      course.spans.push(...r.spans);
      course.items.push(...r.items);
      built.push(m.index);
      course.timeline = assembleTimeline({ ...plan, modules: plan.modules.filter((x) => built.includes(x.index)) }, course.spans, course.items);
      await store.updateCourse(slug, { course });
      await report({ modulesReady: built.length, costUsd: progress.costUsd + r.usage.costUsd });
    }

    if (!course.timeline.some((b) => b.kind === "clip")) throw new Error("No clips were found for any objective");
    course.status = "ready";
    await store.updateCourse(slug, { course });
    await report({ step: "ready", message: "Ready" });
  } catch (e) {
    await store.updateCourse(slug, { progress: { ...progress, step: "failed", message: e instanceof Error ? e.message : String(e) } });
  }
}

export function newRecord(slug: string, input: PlanInput): CourseRecord {
  const now = new Date().toISOString();
  return {
    slug,
    input,
    course: null,
    progress: { step: "queued", message: "Queued", modulesReady: 0, modulesTotal: 0, costUsd: 0, warnings: [] },
    createdAt: now,
    updatedAt: now,
  };
}
