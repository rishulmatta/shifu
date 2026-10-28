"use client";

// Paper or ink: a switch between the light and dark themes, remembered in the browser. The system
// setting applies until the learner picks one (layout.tsx applies the saved choice before paint).

import { useSyncExternalStore } from "react";
import styles from "./theme-toggle.module.css";

type Theme = "light" | "dark";

const KEY = "shifu-theme";
const listeners = new Set<() => void>();

function current(): Theme {
  const saved = document.documentElement.dataset.theme;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  system.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    system.removeEventListener("change", listener);
  };
}

function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, current, () => null);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className={`${styles.toggle} ${className ?? ""}`}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to paper (light theme)" : "Switch to ink (dark theme)"}
      title={dark ? "Paper" : "Ink"}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path className={styles.half} d="M10 2.5 A7.5 7.5 0 0 1 10 17.5 Z" fill="currentColor" />
      </svg>
    </button>
  );
}
