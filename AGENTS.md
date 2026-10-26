<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shifu

Hackathon build for the Meta Global AI Developer Hackathon; submission due Thu 5 Nov 2026, 1:00 PM
AEDT. `PLAN.md` is the plan: read it before working, and keep it current when a decision changes.

- Everything in this repo is new work. Nothing is copied from other projects (Mixie, Interlocutor,
  ScoreFluent); borrowing their ideas is fine.
- Meta's models do the real work: Muse Spark on Meta Model API, Muse Spark Open on Baseten, Muse
  Voice Transcribe. Model ids live in config and env, not scattered through the code.
- YouTube: captions come from the hosted transcript API and playback is the official IFrame embed.
  Never download video or audio, and never show caption text verbatim.
- Secrets live in `.env.local` (names in `.env.example`). Never commit, print or log them.
- `scripts/spikes/` holds throwaway checks of external APIs (`pnpm spike:*`).
- Checks: `pnpm typecheck`, `pnpm lint`, `pnpm build`.
