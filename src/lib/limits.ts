// Spending guards (PLAN.md §4): per-visitor limits and a daily cap on course builds, so a public
// URL can't run through the model credits. Counters live in the store.

import type { Store } from "./store";

export const LIMITS = {
  buildsPerVisitorPerHour: 3,
  buildsPerDay: Number(process.env.SHIFU_DAILY_BUILDS || 30),
  teachbacksPerVisitorPerHour: 20,
  coachPerVisitorPerHour: 40,
  /** Prerequisite concepts the coach builds from new clips: each is a small build. */
  growsPerVisitorPerHour: 6,
  growsPerDay: Number(process.env.SHIFU_DAILY_GROWS || 60),
};

/** The caller's IP as Vercel forwards it, or "local" in development. */
export function visitor(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

export type LimitResult = { ok: true } | { ok: false; message: string };

/** The visitor's own limit is checked first, so a refused visitor doesn't use up the daily cap. */
export async function allowBuild(store: Store, who: string): Promise<LimitResult> {
  const mine = await store.bump(`builds:${who}`, 3_600);
  if (mine > LIMITS.buildsPerVisitorPerHour) {
    return { ok: false, message: "You've started a few courses in the last hour. Try again a bit later, or open one below." };
  }
  const today = await store.bump("builds:all", 86_400);
  if (today > LIMITS.buildsPerDay) {
    return { ok: false, message: "Shifu has built all the courses it can for today. Try one of the courses below, or come back tomorrow." };
  }
  return { ok: true };
}

export async function allowTeachback(store: Store, who: string): Promise<LimitResult> {
  const mine = await store.bump(`teachback:${who}`, 3_600);
  return mine > LIMITS.teachbacksPerVisitorPerHour
    ? { ok: false, message: "That's a lot of explaining for one hour. Take a break and try again later." }
    : { ok: true };
}

export async function allowCoach(store: Store, who: string): Promise<LimitResult> {
  const mine = await store.bump(`coach:${who}`, 3_600);
  return mine > LIMITS.coachPerVisitorPerHour
    ? { ok: false, message: "That's a lot of changes for one hour. Keep going with the course and try again later." }
    : { ok: true };
}

export async function allowGrow(store: Store, who: string): Promise<LimitResult> {
  const mine = await store.bump(`grow:${who}`, 3_600);
  if (mine > LIMITS.growsPerVisitorPerHour) {
    return { ok: false, message: "You've added a few new concepts in the last hour. Work through them first, then ask again." };
  }
  const today = await store.bump("grow:all", 86_400);
  if (today > LIMITS.growsPerDay) return { ok: false, message: "Shifu has added all the new concepts it can for today. Try again tomorrow." };
  return { ok: true };
}
