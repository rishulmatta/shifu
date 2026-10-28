# Shifu: design spec

Shifu (師父) is a master: the one who shows you the exact move, watches you try it, and marks it
with a seal only when you can do it on your own. The interface borrows the world of the martial
arts master as it appears in ink painting: rice paper, one confident brush stroke, and a red seal.
Everything else stays quiet so the clips, the questions and the learner's own progress carry the
screen.

## The mark

- **The ensō**: one brush stroke, a circle left open where the brush lifts. Heavy where it lands
  (upper right), even through the body, a long dry taper at the lift, with three flecks of ink
  thrown past it. It is the master's single stroke, and the circle of the course.
- **The seal**: a vermilion chop stamped inside, set six degrees off true as a hand stamps it, with
  a play triangle cut clean through it so the paper shows. A master's seal on a clip worth
  watching. The same seal, with a check mark instead of the triangle, is stamped on anything the
  learner gets right.
- One geometry generates every asset (`scripts/brand.mts`): `public/brand/shifu-mark-*.svg`,
  the wordmark, the favicon and the path constants the components use.
- The mark is original work. It draws on the archetype of the ink-and-brush master, not on any
  character or studio's design.

## Colour

Tokens live in `src/app/globals.css`, each written once with `light-dark()`. The scheme follows
the system; `ThemeToggle` writes `data-theme` on `<html>` to override it, remembered in the
browser and applied before first paint.

| Token | Paper (light) | Ink (dark) | Used for |
|---|---|---|---|
| `--paper` | warm rice paper | lacquer black | page |
| `--surface` | near-white | warm charcoal | cards |
| `--ink` | near-black | bone | text, the ensō |
| `--vermilion` | seal red | lifted seal red | the seal, actions, focus, eyebrows |
| `--gold` | amber | brighter amber | accents on "learning" moments |
| `--state-new / learning / shaky / solid` | grey, amber, red, jade | lifted | mastery everywhere |

A faint rice-paper grain (an inline SVG noise, 5% light / 3.5% dark) sits over the whole page.

## Type

- **Display**: Fraunces, variable, at a large optical size with a little `SOFT` so titles feel
  inked rather than typeset. Headings, the course title, big numbers ("Before: 1 of 4. Now: 4 of 4").
- **Body and UI**: Geist Sans.
- **Evidence**: Geist Mono for timestamps, model names and anything that reads as a record.
- Eyebrows are small caps in vermilion, wide tracking: the one place red is used for text.

## Motion

Motion exists to show what the models are doing and what the learner has earned, never to
decorate. Rules:

1. **The brush draws, the seal stamps.** The home-page mark draws its ensō on (a conic mask
   sweep, 1.1 s) and the seal comes down after it (scale 2 → 0.94 → 1 with a slight twist, 0.5 s).
   A right answer stamps the check seal with the same motion. An objective going solid stamps its dot.
2. **Cards arrive from below** (12px rise, 320 ms, ease-out) when the lesson moves to a new block.
   Nothing slides sideways.
3. **Work in progress breathes**: the current build step and the coach's working state pulse at
   1.4 s. A build step completing fills its marker with a short pop.
4. **The map grows**: nodes pop in staggered (70 ms apart), prerequisite lines draw on, and a line
   from a solid concept flows.
5. **Reduced motion** turns all of it off (`prefers-reduced-motion`): the mark appears whole, cards
   appear in place, nothing pulses.

Easings: `--ease-out` for arrivals, `--ease-spring` for pops, `--ease-stamp` for the seal.

## Surfaces

- Cards: `--surface`, 1px `--rule`, 20px radius, a soft card shadow. One card is the lesson.
- Fields: `--paper` wells inside cards, 14px radius, a vermilion focus ring.
- Primary action: ink on paper (a brush-black pill). The seal red is for the one action that
  matters on the home page: building the course.
- The header is paper at 92% with a blur, a thin rule beneath, the mark at 28px.

## The path

The whole course, laid out under the lesson as a strip the learner can scroll and tap.

- **Chapters** across the top: numbered seals with the chapter title, a vermilion line along the
  bottom showing how much of it is studied. The current chapter is inked.
- **Concepts** as paper cards in teaching order, each with its mastery dots. Inside, every clip is
  a **part**: YouTube's own still, a seal with the part number (bars breathe on the one playing),
  the clip's length, the objective it teaches and the creator. Checks, flashcards, quizzes and
  teach-backs sit between the parts as small round marks that fill as they are done: a right
  check goes jade, a wrong one red, a quiz shows its score.
- The current card is framed in vermilion and the strip scrolls to keep it in view.
- **Changes land where they belong.** A concept the coach is building appears as a dashed card
  in its place with a sweeping line until its videos arrive; new parts and practice marks stamp
  themselves on with the seal's motion. Modules that finish building appear the same way.

Under the video: playback speed (1× to 2×, remembered in the browser), previous and next clip,
the creator credit, and "In this clip", the points the clip covers.

## Screens

- **Home**: the mark draws itself, the name in Fraunces, the tagline, then a single question:
  "What do you want to learn?" The example topics rotate in the placeholder. Recent courses
  below as paper cards. An ink wash sits behind the hero in the paper's own tones.
- **Building**: the topic as a title, five steps down the left with the Meta model that does each
  one, the outline filling in beside it, and the mind map growing as the plan arrives.
- **Lesson**: one card at a time, the progress track as a brushed line, the path beneath, the outline and mind map
  to the right, the coach as an ink launcher bottom right.
- **Results** (quiz, goal challenge, teach-back): the number first, large, then what to do about it.

## Accessibility

Contrast stays at AA on both schemes. Every animation has a reduced-motion fallback. Focus is
always visible (vermilion ring). Mastery is never colour alone: dots have labels, rings have
counts, and the seal carries a check.
