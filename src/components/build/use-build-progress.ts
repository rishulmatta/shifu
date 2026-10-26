"use client";

// Polls a course's build progress and refreshes the server-rendered page whenever it moves, so the
// outline appears once planned and each module becomes playable as soon as it is built.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BuildProgress } from "@/lib/store";

type Shown = Pick<BuildProgress, "step" | "message" | "modulesReady" | "modulesTotal">;

const DONE = new Set(["ready", "failed"]);

export function useBuildProgress(slug: string, initial: Shown, everyMs = 2000): Shown {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const last = useRef(`${initial.step}:${initial.modulesReady}:${initial.modulesTotal}`);

  useEffect(() => {
    if (DONE.has(initial.step)) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/courses/${slug}/progress`, { cache: "no-store" });
        if (res.ok) {
          const next: Shown = await res.json();
          if (stopped) return;
          setProgress(next);
          const key = `${next.step}:${next.modulesReady}:${next.modulesTotal}`;
          if (key !== last.current) {
            last.current = key;
            router.refresh();
          }
          if (DONE.has(next.step)) return;
        }
      } catch {
        // A missed poll is fine; try again on the next tick.
      }
      if (!stopped) timer = setTimeout(tick, everyMs);
    };
    let timer = setTimeout(tick, everyMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [slug, initial.step, everyMs, router]);

  return progress;
}
