"use client";

// The learner's playback speed, kept in this browser and shared by every clip (PLAN.md §3).

import { useSyncExternalStore } from "react";

export const RATES = [1, 1.25, 1.5, 1.75, 2] as const;
export type Rate = (typeof RATES)[number];

const KEY = "shifu-speed";
const listeners = new Set<() => void>();
/** The speed chosen on this page, so it holds even where storage is refused. */
let chosen: Rate | null = null;

function current(): Rate {
  if (chosen) return chosen;
  try {
    const saved = Number(localStorage.getItem(KEY));
    return (RATES as readonly number[]).includes(saved) ? (saved as Rate) : 1;
  } catch {
    return 1;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setPlaybackRate(rate: Rate) {
  chosen = rate;
  try {
    localStorage.setItem(KEY, String(rate));
  } catch {
    // Private windows may refuse; the speed then lasts for this page only.
  }
  listeners.forEach((l) => l());
}

export function usePlaybackRate(): Rate {
  return useSyncExternalStore(subscribe, current, () => 1);
}
