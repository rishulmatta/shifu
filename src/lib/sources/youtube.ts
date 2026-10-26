// YouTube discovery and captions (PLAN.md §6 steps 2–3). Search and captions come from SearchAPI;
// the YouTube Data API is the fallback for search. Whether a video may be embedded is checked with
// YouTube's public oEmbed endpoint, which needs no key. Shifu never downloads video or audio.

import type { CaptionLine } from "../types";

export interface VideoHit {
  id: string;
  title: string;
  channel: string;
  durationS: number;
  views: number;
}

const SEARCHAPI = "https://www.searchapi.io/api/v1/search";

export class SourceError extends Error {}

const searchApiKey = () => process.env.SEARCHAPI_API_KEY || "";
const youtubeKey = () => process.env.YOUTUBE_API_KEY || "";
export const canSearch = () => Boolean(searchApiKey() || youtubeKey());
export const canFetchCaptions = () => Boolean(searchApiKey());

/** "20:08" or "3:22:45" → seconds; NaN when it isn't a clock. */
export function clockToSeconds(clock: string): number {
  const parts = clock.trim().split(":").map(Number);
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return NaN;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/** ISO 8601 duration (PT1H2M3S) → seconds. */
export function isoToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const part = (i: number) => Number(m?.[i] ?? 0);
  return part(1) * 3600 + part(2) * 60 + part(3);
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

interface SearchApiVideo {
  id?: string;
  title?: string;
  live?: boolean;
  length?: string;
  extracted_views?: number;
  channel?: { title?: string };
}

export function parseSearchApi(body: { videos?: SearchApiVideo[] }): VideoHit[] {
  return (body.videos ?? []).flatMap((v) => {
    const durationS = clockToSeconds(v.length ?? "");
    if (!v.id || !v.title || v.live || !Number.isFinite(durationS)) return [];
    return [{ id: v.id, title: v.title, channel: v.channel?.title ?? "", durationS, views: v.extracted_views ?? 0 }];
  });
}

async function searchWithSearchApi(query: string): Promise<VideoHit[]> {
  const url = `${SEARCHAPI}?${new URLSearchParams({ engine: "youtube", q: query, gl: "us", hl: "en" })}`;
  const r = await getJson(url, { headers: { Authorization: `Bearer ${searchApiKey()}` } });
  if (!r.ok) throw new SourceError(`SearchAPI search ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return parseSearchApi(r.body);
}

async function searchWithDataApi(query: string): Promise<VideoHit[]> {
  const params = (p: Record<string, string>) => new URLSearchParams({ ...p, key: youtubeKey() });
  const found = await getJson(
    `https://www.googleapis.com/youtube/v3/search?${params({ part: "id", q: query, type: "video", videoEmbeddable: "true", relevanceLanguage: "en", safeSearch: "strict", maxResults: "15" })}`,
  );
  if (!found.ok) throw new SourceError(`YouTube search ${found.status}`);
  const ids = (found.body.items ?? []).map((i: { id: { videoId: string } }) => i.id.videoId);
  if (!ids.length) return [];
  const details = await getJson(`https://www.googleapis.com/youtube/v3/videos?${params({ part: "snippet,contentDetails,statistics", id: ids.join(",") })}`);
  if (!details.ok) throw new SourceError(`YouTube videos ${details.status}`);
  return (details.body.items ?? []).map(
    (v: { id: string; snippet: { title: string; channelTitle: string }; contentDetails: { duration: string }; statistics?: { viewCount?: string } }) => ({
      id: v.id,
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      durationS: isoToSeconds(v.contentDetails.duration),
      views: Number(v.statistics?.viewCount ?? 0),
    }),
  );
}

export async function searchVideos(query: string): Promise<VideoHit[]> {
  if (searchApiKey()) return searchWithSearchApi(query);
  if (youtubeKey()) return searchWithDataApi(query);
  throw new SourceError("No search key: set SEARCHAPI_API_KEY or YOUTUBE_API_KEY");
}

/** Whether YouTube lets other sites embed the video (oEmbed answers 401/403/404 when not). */
export async function isEmbeddable(videoId: string): Promise<boolean> {
  const url = `https://www.youtube.com/oembed?${new URLSearchParams({ url: `https://www.youtube.com/watch?v=${videoId}`, format: "json" })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  return res?.ok ?? false;
}

interface SearchApiTranscript {
  transcripts?: { text?: string; start?: number; duration?: number }[];
  available_languages?: { name?: string; lang?: string }[];
  error?: string;
}

/**
 * Caption lines from a SearchAPI response, or null when there are none in the language asked for.
 * A track that only exists as a machine translation (no available language matches) is refused.
 */
export function parseCaptions(body: SearchApiTranscript, lang: string): CaptionLine[] | null {
  if (body.error || !body.transcripts?.length) return null;
  const native = (body.available_languages ?? []).some((l) => l.lang?.toLowerCase().startsWith(lang));
  if (body.available_languages && !native) return null;
  return body.transcripts
    .filter((t) => typeof t.start === "number" && typeof t.text === "string" && t.text.trim())
    .map((t) => ({ start: t.start as number, duration: t.duration ?? 0, text: (t.text as string).replace(/\s+/g, " ").trim() }));
}

export async function fetchCaptions(videoId: string, lang = "en"): Promise<CaptionLine[] | null> {
  if (!searchApiKey()) throw new SourceError("No captions key: set SEARCHAPI_API_KEY");
  const url = `${SEARCHAPI}?${new URLSearchParams({ engine: "youtube_transcripts", video_id: videoId, lang })}`;
  const r = await getJson(url, { headers: { Authorization: `Bearer ${searchApiKey()}` } });
  if (r.ok || r.body?.error) return parseCaptions(r.body, lang);
  throw new SourceError(`SearchAPI captions ${r.status}`);
}
