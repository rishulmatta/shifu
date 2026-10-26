// Spike: YouTube Data API search + metadata filter (embeddable, 3-40 min). Prints candidate ids.
// Run: pnpm spike:youtube ["query"]
// Quota: search.list costs 100 units of the default 10,000 a day; videos.list costs 1.

const key = process.env.YOUTUBE_API_KEY;
if (!key) throw new Error("YOUTUBE_API_KEY is not set (.env.local)");
const q = process.argv[2] ?? "Bayes theorem explained";

const api = async (path: string, params: Record<string, string>) => {
  const url = `https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key })}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(body.error ?? body)}`);
  return body;
};

/** ISO 8601 duration (PT1H2M3S) → seconds. */
const seconds = (iso: string) => {
  const [, h = 0, m = 0, s = 0] = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)?.map(Number) ?? [];
  return h * 3600 + m * 60 + s;
};

const search = await api("search", {
  part: "id",
  q,
  type: "video",
  videoEmbeddable: "true",
  relevanceLanguage: "en",
  safeSearch: "strict",
  maxResults: "15",
});
const ids = search.items.map((i: { id: { videoId: string } }) => i.id.videoId);
const videos = await api("videos", { part: "snippet,contentDetails,status,statistics", id: ids.join(",") });

const kept = [];
for (const v of videos.items) {
  const dur = seconds(v.contentDetails.duration);
  const ok = v.status.embeddable && dur >= 180 && dur <= 2400;
  console.log(
    `${ok ? "keep" : "drop"}  ${v.id}  ${String(Math.round(dur / 60)).padStart(3)} min  ` +
      `captions:${v.contentDetails.caption}  views:${v.statistics.viewCount ?? "?"}  ${v.snippet.channelTitle} — ${v.snippet.title}`,
  );
  if (ok) kept.push(v.id);
}
console.log(`\n${kept.length} kept: ${kept.join(" ")}`);
