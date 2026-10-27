# Muse Code tasks

Small, self-contained modules for Muse Code to build (PLAN.md §4, "Who builds what"). Each
works on its own branch, commits its own work, and is merged when done. Read `AGENTS.md` and
`PLAN.md` §3 and §7 first. The shared shapes are in `src/lib/types.ts`; the mastery rules in
`src/lib/mastery.ts`.

## Task 1: the mind map (`src/components/mind-map/`): done by Claude Code, 28 Oct

Taken over so it could anchor the demo; kept here as the spec it was built to (hand-drawn SVG in
the end, not `@xyflow/react`).

A component that shows a course's concepts and their prerequisites as a graph, each concept ringed
by how well the learner knows its objectives.

```tsx
<MindMap
  plan={course.plan}                      // CoursePlan: modules, concepts, prerequisites
  states={states}                         // Record<ObjectiveId, MasteryState>
  currentConceptId={concept?.id}
  onSelect={(conceptId) => …}             // the player jumps to that concept
/>
```

- Use `@xyflow/react`. One node per concept, one edge per prerequisite (from the prerequisite to
  the concept). Lay modules out left to right (or top to bottom on narrow screens); concepts in a
  module stack in their plan order. No physics, no dragging.
- Each node: the concept title, and a ring split into one segment per objective, coloured by
  state with the CSS variables in `src/app/globals.css`: `--state-new` (outline only),
  `--state-learning`, `--state-shaky`, `--state-solid`. The current concept gets the
  `--vermilion` outline.
- Clicking a node calls `onSelect`. Keyboard: nodes are focusable and Enter selects.
- Works in light and dark mode (use the CSS variables only), at 390 px wide, and with the sample
  course: `import { bayesCourse } from "@/lib/fixtures/bayes"`.
- Plain CSS module, no Tailwind. A small test of the layout function (which node goes where).
- Add it as a tab or toggle beside the outline in `src/components/player/outline.tsx` only if
  asked; the first deliverable is the component plus a story page at `/dev/mind-map` that renders
  the sample course with a few hand-set states.

## Task 2: the review scheduler (`src/lib/review.ts`)

Spaced repetition for flashcards and objective checks, wrapping `ts-fsrs`.

```ts
export interface ReviewCard { id: string; kind: "card" | "check"; objectiveId: ObjectiveId; fsrs: FsrsState }
export function newCard(id: string, kind: ReviewCard["kind"], objectiveId: ObjectiveId, now: Date): ReviewCard;
export function rate(card: ReviewCard, rating: "again" | "hard" | "good" | "easy", now: Date): ReviewCard;
export function due(cards: ReviewCard[], now: Date): ReviewCard[];          // oldest due first
export function estimateMinutes(cards: ReviewCard[]): number;              // for the Today panel
```

- `FsrsState` is whatever `ts-fsrs` needs, stored as plain JSON (dates as ISO strings) because it
  lives in the browser's `localStorage` (`src/lib/learner.ts`).
- Default FSRS parameters, request retention 0.9.
- `estimateMinutes`: 15 s per card, 30 s per check, rounded up to whole minutes.
- Pure functions, no React. Tests with fixed dates: a new card rated "good" is due later than one
  rated "hard"; "again" makes it due within the day; `due` excludes future cards and sorts by
  due date.

## When done

- `pnpm test`, `pnpm typecheck` and `pnpm lint` pass.
- Commit on the branch with a message that says Muse Code wrote it.
- Add a line to the "Log" in `PROGRESS.md`.
