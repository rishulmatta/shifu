import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileStore } from "./file";
import type { CourseRecord } from "./types";

const record = (slug: string, createdAt: string): CourseRecord => ({
  slug,
  input: { topic: "Bayes", goal: "g", level: "beginner", minutesPerDay: 20 },
  course: null,
  progress: { step: "queued", message: "", modulesReady: 0, modulesTotal: 0, costUsd: 0, warnings: [] },
  createdAt,
  updatedAt: createdAt,
});

describe("FileStore", async () => {
  const store = new FileStore(await mkdtemp(join(tmpdir(), "shifu-store-")));

  it("creates, reads, updates and lists courses newest first", async () => {
    await store.createCourse(record("older", "2026-10-27T00:00:00Z"));
    await store.createCourse(record("newer", "2026-10-27T01:00:00Z"));
    await store.updateCourse("older", { progress: { ...record("x", "").progress, step: "ready" } });
    expect((await store.getCourse("older"))?.progress.step).toBe("ready");
    expect((await store.listCourses(10)).map((r) => r.slug)).toEqual(["newer", "older"]);
    expect(await store.getCourse("missing")).toBeNull();
  });

  it("tells 'not cached' apart from 'no captions'", async () => {
    expect(await store.getCaptions("v1", "en")).toBeUndefined();
    await store.putCaptions("v1", "en", null);
    expect(await store.getCaptions("v1", "en")).toBeNull();
    await store.putCaptions("v2", "en", [{ start: 0, duration: 2, text: "hi" }]);
    expect(await store.getCaptions("v2", "en")).toEqual([{ start: 0, duration: 2, text: "hi" }]);
  });

  it("caches searches and embed checks", async () => {
    await store.putSearch("Bayes Theorem", [{ id: "a", title: "t", channel: "c", durationS: 300, views: 1 }]);
    expect((await store.getSearch("bayes theorem"))?.[0].id).toBe("a");
    expect(await store.getEmbeddable("a")).toBeUndefined();
    await store.putEmbeddable("a", false);
    expect(await store.getEmbeddable("a")).toBe(false);
  });
});
