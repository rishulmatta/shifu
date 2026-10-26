# Progress

The build tracker for Shifu, updated with every milestone commit. Milestones and their "done when"
tests come from [`PLAN.md`](PLAN.md) §10. Dates are Sydney time (AEDT); the submission is due
**Thu 5 Nov, 1:00 PM AEDT** (Wed 4 Nov, 9:00 PM ET).

**Legend:** ✅ done · 🔄 in progress · ⏳ blocked or waiting · ⬜ not started

| Day | Date | Milestone | Done when | Status |
|---|---|---|---|---|
| 1 | Tue 27 Oct | Skeleton, plan, brand, public repo | the repo is public with the plan and a building app | ✅ [`d43a778`](https://github.com/rishulmatta/shifu/commit/d43a778) |
| 1 | Tue 27 Oct | API tests against live keys | every test script returns real output | 🔄 Baseten ✅; Meta, YouTube and captions waiting on keys |
| 2 | Wed 28 Oct | Shared types, fixture course, model router, plan step, discovery and captions | topic → outline plus candidate videos with captions in the database | 🔄 types, sample course, router and planning ✅ (live on Baseten); discovery, captions and database waiting on keys |
| 3 | Thu 29 Oct | Span locating, verification and merge | at least 7 of 10 hand-checked spans acceptable | 🔄 locate, verify and choose ✅ on test transcripts (live on Baseten); the 10-span eval needs real captions |
| 4 | Fri 30 Oct | Course player and recall items with both checks | one full module playable end to end | 🔄 player ✅ on the sample course; recall with the quote and answer-blind checks ✅ on test transcripts |
| 5 | Sat 31 Oct | The learner's path, mastery and the progress tracker | a miss plays a different creator; progress survives a reload | 🔄 both pass on the sample course; review queue and Today panel not started |
| 6 | Sun 1 Nov | Teach-back by voice and flashcards | a spoken explanation is graded with rewatch links | ⬜ |
| 7 | Mon 2 Nov | Live deployment, demo courses, review queue, Today panel | the live URL works for a stranger with no sign-up | ⬜ |
| 8 | Tue 3 Nov | Feature freeze, README, demo script | README done; video script locked | ⬜ |
| 9 | Wed 4 Nov | Demo video recorded | video uploaded and its link checked | ⬜ |
| 10 | Thu 5 Nov | Submitted, by 10:00 AM AEDT | submitted; repo public; video plays when logged out | ⬜ |

## Waiting on

- [x] Baseten key in `.env.local` (credits granted)
- [ ] Meta Model API key and the $150 credits (claim link not out yet)
- [ ] YouTube Data API key, and the quota-increase request
- [ ] Transcript vendor key (SearchAPI recommended)
- [x] Muse Code installed
- [ ] Muse Code's review of the plan
- [ ] Modal and Fireworks credit requests

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
