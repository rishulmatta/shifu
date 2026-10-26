import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allowBuild, allowTeachback, LIMITS, visitor } from "./limits";
import { FileStore } from "./store/file";

const fresh = async () => new FileStore(await mkdtemp(join(tmpdir(), "shifu-limits-")));

describe("limits", () => {
  it("lets a visitor start a few builds an hour, then refuses", async () => {
    const store = await fresh();
    const results = [];
    for (let i = 0; i <= LIMITS.buildsPerVisitorPerHour; i++) results.push((await allowBuild(store, "1.2.3.4")).ok);
    expect(results).toEqual([...Array(LIMITS.buildsPerVisitorPerHour).fill(true), false]);
    expect((await allowBuild(store, "5.6.7.8")).ok).toBe(true);
  });

  it("stops everyone once the daily cap is reached, without charging refused visitors to it", async () => {
    const store = await fresh();
    for (let i = 0; i < LIMITS.buildsPerDay; i++) await allowBuild(store, `visitor-${i}`);
    expect((await allowBuild(store, "late")).ok).toBe(false);
  });

  it("limits teach-backs per visitor", async () => {
    const store = await fresh();
    for (let i = 0; i < LIMITS.teachbacksPerVisitorPerHour; i++) expect((await allowTeachback(store, "a")).ok).toBe(true);
    expect((await allowTeachback(store, "a")).ok).toBe(false);
  });

  it("reads the visitor from forwarded headers", () => {
    expect(visitor(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(visitor(new Headers())).toBe("local");
  });
});
