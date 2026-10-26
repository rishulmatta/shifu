// The production store: Postgres via `pg`, used whenever DATABASE_URL is set. Courses are JSON
// documents (always read whole); the tables are created on first use.

import { Pool } from "pg";
import type { VideoHit } from "../sources/youtube";
import type { CaptionLine } from "../types";
import type { CourseRecord, Store } from "./types";

const SCHEMA = `
create table if not exists courses (
  slug text primary key,
  input jsonb not null,
  course jsonb,
  progress jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists captions (
  video_id text not null,
  lang text not null,
  lines jsonb,
  fetched_at timestamptz not null default now(),
  primary key (video_id, lang)
);
create table if not exists searches (
  query text primary key,
  hits jsonb not null,
  fetched_at timestamptz not null default now()
);
create table if not exists embeddable (
  video_id text primary key,
  embeddable boolean not null,
  checked_at timestamptz not null default now()
);
create table if not exists rate_limits (
  key text not null,
  bucket bigint not null,
  count integer not null,
  primary key (key, bucket)
);`;

interface CourseRow {
  slug: string;
  input: CourseRecord["input"];
  course: CourseRecord["course"];
  progress: CourseRecord["progress"];
  created_at: Date;
  updated_at: Date;
}

const toRecord = (r: CourseRow): CourseRecord => ({
  slug: r.slug,
  input: r.input,
  course: r.course,
  progress: r.progress,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export class PostgresStore implements Store {
  private readonly pool: Pool;
  private ready: Promise<unknown> | null = null;

  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX || 5) });
  }

  private async q<T = unknown>(sql: string, params: unknown[] = []) {
    this.ready ??= this.pool.query(SCHEMA);
    await this.ready;
    return (await this.pool.query(sql, params)).rows as T[];
  }

  async createCourse(r: CourseRecord) {
    await this.q("insert into courses (slug, input, course, progress) values ($1, $2, $3, $4)", [r.slug, r.input, r.course, r.progress]);
  }

  async getCourse(slug: string) {
    const [row] = await this.q<CourseRow>("select * from courses where slug = $1", [slug]);
    return row ? toRecord(row) : null;
  }

  async updateCourse(slug: string, patch: Partial<Pick<CourseRecord, "course" | "progress">>) {
    await this.q(
      `update courses set
         course = case when $2::boolean then $3::jsonb else course end,
         progress = coalesce($4::jsonb, progress),
         updated_at = now()
       where slug = $1`,
      [slug, "course" in patch, patch.course ?? null, patch.progress ?? null],
    );
  }

  async listCourses(limit: number) {
    return (await this.q<CourseRow>("select * from courses order by created_at desc limit $1", [limit])).map(toRecord);
  }

  async getCaptions(videoId: string, lang: string) {
    const [row] = await this.q<{ lines: CaptionLine[] | null }>("select lines from captions where video_id = $1 and lang = $2", [videoId, lang]);
    return row ? row.lines : undefined;
  }

  async putCaptions(videoId: string, lang: string, lines: CaptionLine[] | null) {
    await this.q(
      `insert into captions (video_id, lang, lines) values ($1, $2, $3)
       on conflict (video_id, lang) do update set lines = excluded.lines, fetched_at = now()`,
      [videoId, lang, lines === null ? null : JSON.stringify(lines)],
    );
  }

  async getSearch(query: string) {
    const [row] = await this.q<{ hits: VideoHit[] }>("select hits from searches where query = $1", [query.toLowerCase()]);
    return row?.hits;
  }

  async putSearch(query: string, hits: VideoHit[]) {
    await this.q(
      `insert into searches (query, hits) values ($1, $2)
       on conflict (query) do update set hits = excluded.hits, fetched_at = now()`,
      [query.toLowerCase(), JSON.stringify(hits)],
    );
  }

  async getEmbeddable(videoId: string) {
    const [row] = await this.q<{ embeddable: boolean }>("select embeddable from embeddable where video_id = $1", [videoId]);
    return row?.embeddable;
  }

  async putEmbeddable(videoId: string, embeddable: boolean) {
    await this.q(
      `insert into embeddable (video_id, embeddable) values ($1, $2)
       on conflict (video_id) do update set embeddable = excluded.embeddable, checked_at = now()`,
      [videoId, embeddable],
    );
  }

  async bump(key: string, windowS: number) {
    const bucket = Math.floor(Date.now() / 1000 / windowS);
    const [row] = await this.q<{ count: number }>(
      `insert into rate_limits (key, bucket, count) values ($1, $2, 1)
       on conflict (key, bucket) do update set count = rate_limits.count + 1
       returning count`,
      [key, bucket],
    );
    return row.count;
  }
}
