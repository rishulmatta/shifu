// The local-development store: one JSON file per record under .data/ (git-ignored). Used whenever
// DATABASE_URL is not set, so the app runs with no database at all.

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VideoHit } from "../sources/youtube";
import type { CaptionLine } from "../types";
import type { CourseRecord, Store } from "./types";

const safe = (key: string) => encodeURIComponent(key.toLowerCase()).slice(0, 180);

export class FileStore implements Store {
  constructor(private readonly root = join(process.cwd(), ".data")) {}

  private path(kind: string, key: string) {
    return join(this.root, kind, `${safe(key)}.json`);
  }

  private async read<T>(kind: string, key: string): Promise<T | undefined> {
    try {
      return JSON.parse(await readFile(this.path(kind, key), "utf8")) as T;
    } catch {
      return undefined;
    }
  }

  /** Write to a temp file and rename, so a reader never sees half a document. */
  private async write(kind: string, key: string, value: unknown) {
    await mkdir(join(this.root, kind), { recursive: true });
    const target = this.path(kind, key);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify(value));
    await rename(temp, target);
  }

  async createCourse(record: CourseRecord) {
    await this.write("courses", record.slug, record);
  }

  async getCourse(slug: string) {
    return (await this.read<CourseRecord>("courses", slug)) ?? null;
  }

  async updateCourse(slug: string, patch: Partial<Pick<CourseRecord, "course" | "progress">>) {
    const current = await this.getCourse(slug);
    if (!current) throw new Error(`No course ${slug}`);
    await this.write("courses", slug, { ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  async listCourses(limit: number) {
    let names: string[] = [];
    try {
      names = await readdir(join(this.root, "courses"));
    } catch {
      return [];
    }
    const records = await Promise.all(
      names.filter((n) => n.endsWith(".json")).map((n) => this.read<CourseRecord>("courses", decodeURIComponent(n.slice(0, -5)))),
    );
    return records
      .filter((r): r is CourseRecord => !!r)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getCaptions(videoId: string, lang: string) {
    const hit = await this.read<{ lines: CaptionLine[] | null }>("captions", `${videoId}.${lang}`);
    return hit === undefined ? undefined : hit.lines;
  }

  async putCaptions(videoId: string, lang: string, lines: CaptionLine[] | null) {
    await this.write("captions", `${videoId}.${lang}`, { lines });
  }

  async getSearch(query: string) {
    return (await this.read<{ hits: VideoHit[] }>("searches", query))?.hits;
  }

  async putSearch(query: string, hits: VideoHit[]) {
    await this.write("searches", query, { hits });
  }

  async getEmbeddable(videoId: string) {
    return (await this.read<{ embeddable: boolean }>("embeddable", videoId))?.embeddable;
  }

  async putEmbeddable(videoId: string, embeddable: boolean) {
    await this.write("embeddable", videoId, { embeddable });
  }

  async bump(key: string, windowS: number) {
    const id = `${key}@${Math.floor(Date.now() / 1000 / windowS)}`;
    const count = ((await this.read<{ count: number }>("limits", id))?.count ?? 0) + 1;
    await this.write("limits", id, { count });
    return count;
  }
}
