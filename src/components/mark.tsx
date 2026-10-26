import { ENSO_PATH, PLAY_PATH } from "./mark-path";

/** The Shifu mark: an ensō brush circle around a play triangle. The ink follows `currentColor`. */
export function Mark({ size = 96 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <path d={ENSO_PATH} fill="currentColor" />
      <path d={PLAY_PATH} fill="var(--vermilion)" stroke="var(--vermilion)" strokeWidth={8} strokeLinejoin="round" />
    </svg>
  );
}
