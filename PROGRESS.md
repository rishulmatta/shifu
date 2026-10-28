# Progress

The build tracker for Shifu, updated with every milestone commit. Milestones and their "done when"
tests come from [`PLAN.md`](PLAN.md) §10. Dates are Sydney time (AEDT); the submission is due
**Thu 5 Nov, 1:00 PM AEDT** (Wed 4 Nov, 9:00 PM ET).

**Legend:** ✅ done · 🔄 in progress · ⏳ blocked or waiting · ⬜ not started

| Day | Date | Milestone | Done when | Status |
|---|---|---|---|---|
| 1 | Tue 27 Oct | Skeleton, plan, brand, public repo | the repo is public with the plan and a building app | ✅ [`d43a778`](https://github.com/rishulmatta/shifu/commit/d43a778) |
| 1 | Tue 27 Oct | API tests against live keys | every test script returns real output | 🔄 Baseten, Meta (planning and voice) and Modal ✅; YouTube search and captions waiting on the SearchAPI key |
| 2 | Wed 28 Oct | Shared types, fixture course, model router, plan step, discovery and captions | topic → outline plus candidate videos with captions in the database | 🔄 types, sample course, router and planning ✅ (live on Meta, Baseten and Modal); discovery, captions and Postgres waiting on keys |
| 3 | Thu 29 Oct | Span locating, verification and merge | at least 7 of 10 hand-checked spans acceptable | 🔄 locate, verify and choose ✅ on test transcripts (live on Baseten); the 10-span eval needs real captions |
| 4 | Fri 30 Oct | Course player and recall items with both checks | one full module playable end to end | 🔄 player ✅ on the sample course; recall with the quote and answer-blind checks ✅ on test transcripts |
| 5 | Sat 31 Oct | The learner's path, mastery and the progress tracker | a miss plays a different creator; progress survives a reload | 🔄 both pass, and a miss now plays the creator who best clears up the mistake; the mind map, the goal challenge, confidence and the course coach ✅; review queue and Today panel not started |
| 6 | Sun 1 Nov | Teach-back by voice and flashcards | a spoken explanation is graded with rewatch links | ✅ spoken and typed teach-backs graded live with rewatch links, the student's follow-up question, flashcards (a real-voice check in a browser still to do) |
| 7 | Mon 2 Nov | Live deployment, demo courses, review queue, Today panel | the live URL works for a stranger with no sign-up | ⬜ |
| 8 | Tue 3 Nov | Feature freeze, README, demo script | README done; video script locked | ⬜ |
| 9 | Wed 4 Nov | Demo video recorded | video uploaded and its link checked | ⬜ |
| 10 | Thu 5 Nov | Submitted, by 10:00 AM AEDT | submitted; repo public; video plays when logged out | ⬜ |

## Waiting on

- [x] Baseten key in `.env.local` (credits granted)
- [x] Meta Model API key and the $150 credits
- [x] Modal: $100 credit and a Shared Endpoint for Muse Spark Open (check that the credit covers
      Shared Endpoint usage)
- [ ] **SearchAPI key** (YouTube search and captions): the one key real course builds, the demo
      courses and the coach's new concepts still need
- [ ] YouTube Data API key (optional now: only the fallback for search when SearchAPI is missing)
- [x] Muse Code installed
- [ ] Muse Code's review of the plan
- [ ] Fireworks credit request (optional)
- [ ] Vercel project and a Postgres database for the live deployment (your accounts)

## Log

### Tue 27 Oct

- Planned the product, the build pipeline, the learner's path and the progress tracker (`PLAN.md`).
- Next.js 16 skeleton, original ensō mark, README, public repo.
- API test scripts for Muse Spark 1.3, Muse Spark Open on Baseten, Muse Voice Transcribe and YouTube.
- Read Meta's docs: Muse Spark 1.3 allows 4M tokens a minute at about $2 per course; Muse Voice
  Transcribe takes WAV only. Baseten granted $100 and 2M tokens a minute.
- Compared seven YouTube transcript APIs; SearchAPI recommended, Supadata runner-up.
- Designed the learner's path (`PLAN.md` §3) and the mastery rules and progress tracker (§7).
- Baseten test passed: Muse Spark Open returns schema-checked JSON. Reasoning dominates output at
  the default effort (2,100 tokens for a six-line transcript). Asking for numbered lines instead of
  an end timestamp fixed span endings at every effort, and effort `none` took 1.7 s.
- Built ahead of the keys: shared types, mastery rules (tested), the timeline assembler (tested),
  a sample Bayes course over real videos, the model router (tested) and the planning step, which
  plans real courses on Muse Spark Open in about 9 s for about $0.01.
- Course player at `/c/bayes-sample`: intro, clip through the official embed, check question,
  "explain it differently" with a second creator and a second question, flashcards, quiz, and the
  progress tracker with resume. Walked end to end in headless Chrome at desktop and phone sizes.
- Pipeline steps 4–7 (`pnpm try:clips`, on two hand-written test transcripts): locating found the
  right span in each video, skipped a sponsor break and claimed nothing either video doesn't teach;
  verification checks quotes, lengths and mid-thought openings; choosing ranks by coverage and
  picks alternates from other channels; recall items pass a quote check and an answer-blind check
  that also drops questions with more than one defensible answer. About 12 s and $0.02 for two
  videos and two objectives.
- YouTube sources (SearchAPI search and captions, keyless oEmbed embed check), a course store
  (Postgres, or files in `.data/` locally) and the build orchestrator: module by module, saved
  after each so module 1 is playable while the rest builds. `pnpm try:build` ran the whole build
  on live models with test video sources: 3 modules in 26 s for $0.05.
- Home page with the create-course form, the build screen (steps, outline as soon as it's planned,
  live status) and a banner while later modules build. Without a SearchAPI key the form explains
  what's missing instead of starting a build.
- Teach-back: record (encoded in the browser to 16 kHz WAV for Muse Voice Transcribe) or type;
  graded per objective as covered, missing or not quite right, with a note, the learner's own
  words (checked against what they said) and a rewatch button on the exact clip; verdicts feed
  mastery. A planted misconception was caught on the first live run.
- Planned "Teaching that works" (`PLAN.md` §3): the goal challenge before and after, a student who
  asks a follow-up in the teach-back, wrong answers that diagnose, confidence, and examples from the
  learner's world. Cut the streak, "continue on another device" and the stretch goals to make room.
- Confidence and diagnosis: every answer is locked in with Guessing, Think so or Sure. A wrong
  pick shows the misconception behind it, a confident miss goes straight to shaky, a lucky guess
  doesn't count towards solid, and the tracker lists "sure, but wrong" objectives. The recall step
  now writes a misconception per distractor and sets the quiz question in the learner's world
  (tested live: a marketing context gave "the chance a clicker is a buyer").
### Wed 28 Oct

- Voice without the Meta key: Muse Spark Open takes audio, so the teach-back transcribes on Baseten
  when there is no Meta key (or Muse Voice Transcribe fails). Tested live: about 7 s and $0.002 for
  30 seconds, wrong explanations kept as said; an echo of the last sentence (two runs in five) is
  trimmed. Modal's $100 credit is wired in as a second Muse Spark Open provider after Baseten.
- All three providers live. Meta: Muse Spark 1.3 plans a course in 24 s for $0.03, and
  the teach-back route transcribes with Muse Voice Transcribe and grades on Muse Spark 1.3 (a
  planted "99% accurate means 99% sure" was caught). Modal: structured output and audio input
  work. Each provider lists the reasoning efforts it accepts and the router rounds up to one. Over
  40 runs Muse Voice Transcribe never lost or invented a word, only stuttered, so it stays first
  with stutters collapsed; Muse Spark Open's transcripts sometimes said "(silence)" or added a
  sentence nobody said, so it is the fallback.
- Mind map: every concept and its prerequisites, each ringed with one segment per objective in its
  mastery colour, the current concept haloed, lines that flow once the concept they start from is
  solid, and nodes that pop in (so a concept added later grows into the map). A compact map sits
  at the top of the progress panel, the "Mind map" button opens it full size for presenting, and
  the build screen shows it as soon as the course is planned. Hand-drawn SVG with a tested layout:
  modules left to right (top to bottom on phones), neighbours joined by straight arrows, longer
  links routed round the concepts in between. Checked in headless Chrome, light and dark, desktop
  and phone.
- The course coach: a panel under the mind map where the learner says what they need. Muse Spark
  1.3 turns each message into one change: practice questions up next (written from the clips,
  quote- and answer-blind-checked), a new prerequisite concept built from fresh clips (its node
  grows into the map while it builds), the idea from another creator, a jump, or skipping ahead.
  The learner's additions live with their progress and are merged into the course they see; the
  shared course never changes. Answered blocks and quiz scores are now kept by block, so added
  blocks can't shift them. Tested live: seven typical messages each picked the right change in
  4–9 s for under a cent; "ask me more questions" added three checked questions in about 10 s; a
  prerequisite built from the two test transcripts in 6 s. Building one from YouTube needs the
  SearchAPI key.
- The coach moved into a floating window (an ink launcher with the ensō mark; a full-screen sheet
  on phones), with coach controls under every clip and answered question. "More practice on
  this" skips the model's decision and goes straight to writing questions (about 10 s end to end);
  "I'm missing the basics" asks only for the foundation that objective lacks. Each reply has a
  card showing where the change lands: questions as squares after an insertion caret, or a new
  prerequisite as a node growing in front of the concept that needs it with the build steps
  filling in; "Show on map" opens the map with it pulsing. Checked in headless Chrome at desktop
  and phone sizes.
- "Explain it differently" now aims at the mistake: the moment a first answer is wrong, the
  server reads the other creators' clips for that objective, picks the one that best clears up the
  misconception behind the pick, writes a "Watch for this" line and a new question aimed at the
  same misconception (the learner's own wrong answer is one of its distractors), with the quote and
  answer-blind checks. About 5 s live; the player waits up to 8 s for it and otherwise uses the
  pre-built alternate, as it does when a course has no captions for the alternates.
- The goal challenge, before and after: right after the plan, Muse Spark 1.3 writes 3 to 5
  scenario questions from the learner's goal, each needing two or three objectives, with a named
  misconception per distractor; each is answered blind and kept only if that answer agrees and no
  other option is defensible. Live on two goals ("pass my stats exam", "pay off my credit card or
  invest"): 4 and 5 kept in about 35 s for $0.05, every key right when checked by hand. The course
  opens with them cold ("I don't know yet" allowed, nothing revealed) and closes with them again,
  with feedback, rewatch links and "Before: 2 of 4. Now: 4 of 4." A concept whose objectives were
  all right before starting says the learner may know it and offers to skip; the progress panel
  shows the goal and both scores. The sample course has four hand-written ones.
- You become the shifu: after the teach-back is graded, a student who listened asks one question at
  the biggest gap, written by the grader in the same call with the learner's recent misconceptions
  in the module as clues. The learner answers out loud (45 s) or types; the answer is graded on
  that objective alone and counts as teach-back evidence, and leads the report. Live: an
  explanation that equated the posterior with the likelihood drew "Wait, so if a 90% accurate test
  is positive, why aren't you 90% likely to be ill?"; a right answer was graded covered and "it
  just stays 90%" a misconception. The recorder is now a hook shared by both. All five "Teaching
  that works" features are built.
- Review scheduler (Muse Code): `src/lib/review.ts` wraps `ts-fsrs` (default parameters, request
  retention 0.9) with `newCard`, `rate`, `due` (oldest first) and `estimateMinutes` (15 s a card,
  30 s a check), storing FSRS state as plain JSON for `localStorage`. Eleven fixed-date tests in
  `src/lib/review.test.ts`; `pnpm test`, `pnpm typecheck` and `pnpm lint` pass. Wiring it into the
  learner state, the review queue and the Today panel is Claude Code's next step.
- The look (`docs/design.md`): the martial-arts master in ink painting. The mark is regenerated by
  `scripts/brand.mts` as an ensō with a heavier landing and a long dry lift, three flecks of ink,
  and a vermilion seal stamped six degrees off true with the play triangle cut through it; the same
  seal with a check is stamped on anything the learner gets right. Fraunces for titles and big
  numbers, Geist for the UI, Geist Mono for timestamps and model names. Every colour is one
  `light-dark()` token; a theme toggle (and `?theme=dark`) overrides the system, applied before
  first paint, with a faint rice-paper grain over both schemes. Home: the ensō draws itself on and
  the seal comes down, the name and tagline rise to meet it, example topics type through the
  placeholder, course cards stamp a seal on hover. Building: a timeline of the five steps with the
  Meta model on each, the current one breathing, the map growing in a card. Lesson: cards rise in,
  a right answer stamps the seal over the corner, a wrong pick shakes, flashcards flip in 3D, the
  teach-back pulses while recording, "Before: 1 of 4. Now: 4 of 4." in display type with the dots
  filling in turn, dots pop as objectives go solid, solid map nodes carry the seal. The coach
  launcher breathes while it works. An Open Graph image for links, the wordmark in the README.
  Everything respects reduced motion. Checked in headless Chrome, both schemes, desktop and phone;
  `pnpm test`, `typecheck`, `lint` and `build` pass.
