// The live video sources the build uses (PLAN.md §6 steps 2–3).

import type { Sources } from "../pipeline/build";
import { canFetchCaptions, canSearch, fetchCaptions, isEmbeddable, searchVideos } from "./youtube";

export const liveSources: Sources = {
  search: searchVideos,
  embeddable: isEmbeddable,
  captions: (videoId) => fetchCaptions(videoId),
};

/** What's missing before a course can be built, in words for the home page. */
export function missingForBuilds(): string[] {
  const missing: string[] = [];
  if (!process.env.META_MODEL_API_KEY && !process.env.BASETEN_API_KEY) missing.push("a model key (Meta Model API or Baseten)");
  if (!canSearch()) missing.push("a YouTube search key (SearchAPI or the YouTube Data API)");
  if (!canFetchCaptions()) missing.push("a captions key (SearchAPI)");
  return missing;
}
