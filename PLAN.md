# Shifu: build plan

Meta Global AI Developer Hackathon. Written Tue 27 Oct 2026 (Sydney).
**Submission due Thu 5 Nov, 1:00 PM AEDT** (Wed 4 Nov, 9:00 PM ET).

## 1. What Shifu is

Type a topic. Shifu designs a structured course (modules → concepts → learning objectives), finds
the moment in a YouTube video that best teaches each objective, and plays those clips through the
official embed, interleaved with recall practice:

- a check question right after each clip;
- flashcards whose answer is the moment in the video;
- a "teach it back" step where the learner explains the idea aloud and is graded against what was said;
- a mind map that shows what they have mastered.

Missing a question plays a different creator's explanation of the same idea, then asks again.

**The problem, firsthand:** learners already learn from YouTube, but from scattered videos with no
structure, no order and no check that anything stuck. Search ranks videos, not explanations; nothing
tells you which 90 seconds of which video teaches the thing you are missing.

- **Theme:** Build for Your World.
- **Track:** Indie developer. Judged on
  creativity, technical ambition and whether it works; $400K of the prize pool. The demo should
  make the ambition visible (span verification, answerability checks, graded teach-back) and never
  break on camera.
- **Name:** working title. PlayShifu is an existing kids' edtech brand; check before a public launch.

## 2. Ground rules

From the participant guide, plus decisions taken in planning:

- **Everything is new.** Own stack, own infrastructure, own accounts. No code or services from
  Mixie, Interlocutor or ScoreFluent; borrowing their ideas is fine.
- **Public repo from day 1:** https://github.com/rishulmatta/shifu. Commit as work lands and push
  at every milestone (the "Done when" column in §10). The history is the evidence of what was built
  during the hackathon.
- **Meta's models do the real work.** Judging stage 1 is a pass/fail on this.
- **Never download video or audio from YouTube.** Captions (text with timestamps) come from a hosted
  transcript API; playback is the official IFrame embed only.
- **Caption text is never shown verbatim.** It is used to find and understand spans. Every clip
  credits the channel and links to the video.
- **No chatbot UI.** The anti-project list names "simple AI for Education chatbots". Shifu is a
  course with a player, not a chat window.
- **Demo video:** 3 minutes, showing only what was built during the hackathon (all of Shifu).
- **Muse Code has a small, real role.** The rules don't require it: judging stage 1 checks that the
  *project* uses Meta Model API or Meta's open-weight models. It does show Meta's tools in use. Muse Code pressure-tests
  this plan and builds two small modules (§4, "Who builds what"). Each agent commits its own work
  as it goes, and the README says exactly what Muse Code did.

## 3. The learner's flow

1. **Start:** topic, goal ("pass my stats exam", "understand transformers for work"), level, time per day.
2. **The course appears fast:** outline and mind map in about 15 s, module 1 lessons in 1–2 min;
   later modules build in the background.
3. **A lesson is a timeline of blocks** per concept:
   `clip → (clip) → check question → … → flashcards`, with a teach-back at the end of each module.
4. **Miss a check question** → "Explain it differently" plays an alternate span from a different
   creator for that objective, then asks a different question on the same objective.
5. **Teach it back:** record up to 90 s explaining the concept; see which points were covered, which
   were missing and any misconceptions, each tied to the clip that covers it, with "rewatch" buttons.
6. **Mind map:** concepts and prerequisites, coloured by mastery; clicking a node opens its lesson
   or review.
7. **Review:** due flashcards and objective checks scheduled by FSRS, mixing earlier concepts.

## 4. Architecture

```
browser: course player, mind map, recorder
   │
Next.js 16 on Vercel: route handlers and server actions
   ├─ build workflow (durable steps, progress streamed to the UI)
   │    plan → discover → transcripts → locate → verify → merge → recall → assemble
   ├─ model router: task → (provider, model), with fallback
   │    Meta Model API: Muse Spark 1.3, Muse Voice Transcribe (stretch: Muse Image, SAM 3.1)
   │    Baseten: Muse Spark Open (meta-models/muse-spark-open-1026)
   ├─ YouTube Data API v3: search, metadata, embeddable flag
   └─ hosted transcript API: captions with timestamps
   │
Postgres (new): courses, transcript cache, spans, recall items, learner state
```

**Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Postgres via `pg` on a new
project, a new Vercel project, Vercel Workflow for the build pipeline (`after()` locally), zod for
every model output, `ts-fsrs` for scheduling, `@xyflow/react` for the mind map, the YouTube IFrame
API for playback.

**No accounts for the hackathon.** An anonymous learner id lives in a cookie and courses have
shareable URLs, so judges can open the live app and start learning without signing up. Credits are
protected by per-IP rate limits and a global daily cap on new course builds; pre-built demo courses
open instantly.

**Interfaces that leave room for later sources:**

- `VideoSource { search, metadata, transcript, embed }`: `youtube` now; `meta-creator`
  (an educator's own Facebook/Instagram videos) as a stretch goal.
- `ModelRouter.run(task, input)`: every model call goes through it, so a task can move to another
  provider when credits or rate limits run out.

### Who builds what

| Agent | Does |
|---|---|
| Muse Code | **Day 1:** reviews this plan with its `/plan` and `/grilling` skills; the useful changes are folded in here. **Days 2–4:** builds two small, self-contained modules: the mind map component (`@xyflow/react`, nodes coloured by mastery, fed by the fixture course) and the FSRS scheduling module (a `ts-fsrs` wrapper) with its tests |
| Claude Code | everything else |

- **Contract first.** On day 2, fix the shared types (course, concept, objective, span, recall
  item, timeline block, mastery) and seed one fixture course, so Muse Code's modules are built
  against the same shapes the pipeline produces.
- **Muse Code works on its own branch**, merged when each task is done. This needs git by day 2.
- Point Muse Code at this file in its first prompt; whether it reads an instruction file such as
  `AGENTS.md` is not documented on its landing page.

## 5. Where each Meta model works

| Task | Model | API | Why |
|---|---|---|---|
| Plan the course: modules, concepts, prerequisite graph (the mind map), objectives, search queries, must-include points per objective | Muse Spark 1.3 | Meta Model API | reasoning and structured output; one call per course |
| Locate the span that teaches each objective in each candidate transcript | Muse Spark Open | Baseten | the fan-out: hundreds of calls per course |
| Merge: best span per objective across videos, plus alternates | Muse Spark 1.3 | Meta Model API | one call per concept; judgment |
| Recall items per clip: check questions, flashcards, cloze cards | Muse Spark Open | Baseten | fan-out |
| Answerability check: answer each question from the clip without the key | Muse Spark Open | Baseten | an independent check (§6, step 7) |
| Transcribe the learner's teach-back | Muse Voice Transcribe | Meta Model API | file endpoint |
| Grade the teach-back against the objectives and clips | Muse Spark 1.3 | Meta Model API | judgment with citations |
| Stretch: diagram flashcards (draw a labelled diagram, mask its labels) | Muse Image → SAM 3.1 | Meta Model API | the image is generated, so there is no rights issue |

**Limits and prices** (Meta's pricing page, 27 Oct): Muse Spark 1.3 allows 3,000 requests and 4M
tokens a minute, at $1.25 in and $4.25 out per million tokens. A course of about 1M input and 0.15M
output tokens therefore costs about $2, so $150 covers roughly 75 courses; the daily build cap
protects it. The `-contributor` variants cost $0.10 / $0.20 but Meta uses the inputs to improve its
products, and here the inputs would be other creators' captions, so the standard variant is the
default. Muse Voice Transcribe costs $0.18 an hour of audio and takes WAV only, at most 10 minutes
and 32 MB per file.

**Baseten** (credits granted 27 Oct): $100 and up to 2M tokens a minute. The key only works with
`meta-models/muse-spark-open-1026`. The model always reasons; reasoning tokens are billed as output.
When Baseten's credits run out, its tasks move to Muse Spark 1.3 on Meta Model API, with Modal
endpoints as a further fallback.

## 6. The build pipeline

Each step is a durable, idempotent workflow step that writes progress for the UI.

1. **Plan** (Muse Spark 1.3, structured output). Input: topic, goal, level, time budget. Output:
   3–5 modules of 3–5 concepts each; prerequisite edges; 1–3 objectives per concept, phrased as
   things the learner can do ("compute a posterior from a prior and a likelihood"); 2–3 search
   queries per concept; for each objective, the 2–4 points a good explanation must include. Total
   watch time fits the learner's budget.

2. **Discover** (YouTube Data API). Per concept: `search.list` (`type=video`,
   `videoEmbeddable=true`, `relevanceLanguage`, `safeSearch=strict`), then `videos.list` for
   duration, caption flag and statistics. Keep 3–40 min videos; rank by relevance, views, channel
   and recency; keep 5–8 per concept.
   **Quota:** `search.list` costs 100 of the default 10,000 units a day, so about 100 searches a day
   (roughly 8 new courses). Cache searches by query, search once per concept rather than per
   objective, and apply for a quota increase on day 1. SearchAPI (the transcript vendor below) also
   offers YouTube search on the same key, which removes that limit; `videos.list` (1 unit) still
   checks embeddable and duration.

3. **Transcripts** (hosted API: SearchAPI's `youtube_transcripts` engine, with Supadata in
   `mode=native` as the runner-up; see §13). Timestamps come per caption line (`start`,
   `duration`), not per word, which is fine for clip boundaries. Fetch in parallel, cache forever by
   video id, drop videos without captions, and check the language that comes back (an auto track
   can come back machine-translated).

4. **Locate** (Muse Spark Open, fan-out). One call per unique video: a video found for several
   concepts gets all of their objectives in one call. Input: the objectives with their must-include
   points, and the transcript as timed lines (`[12:31] …`). Output per objective: spans
   `{start, end, covers[], selfContained, dependsOn?, quote}`, or none. Volume: a 30-min transcript
   is about 7K tokens, so 12 concepts × 6 videos is about 0.5M input tokens per course.

5. **Verify** (deterministic code, no model).
   - Snap boundaries to caption-line edges and clamp each span to 30–240 s.
   - The span's `quote` must fuzzy-match transcript text inside the span, or the span is dropped.
   - Flag openings that lean on earlier context ("as we saw", "this one here"): pull the start
     back to where that context begins, or mark the span not self-contained.

6. **Merge** (Muse Spark 1.3). Per concept: the best span per objective, plus up to 2 alternates
   from different creators (the "explain it differently" pool). Prefer self-contained spans that
   cover every must-include point, fit the time budget and vary the creators.

7. **Recall** (Muse Spark Open, fan-out per chosen span). 2–3 check questions (multiple choice with
   plausible distractors, or short answer) and 2–4 flashcards (basic or cloze), each with evidence
   `{spanId, quote}`. Two checks:
   - **Quote check:** the quote must be in the span's transcript text, or the item is dropped.
   - **Answerability check:** a separate call answers the question from the span text alone,
     without the key. If it disagrees with the key or picks a distractor, drop the item and
     regenerate once.

   This is the "verifiable agents" story (the Agents 102 workshop covers it).

8. **Assemble.** Write the course timeline: per concept, its clips in objective order with a check
   after each objective and flashcards at the end; a teach-back at the end of each module.

Module 1 runs through every step first so the learner can start; the rest follows in the background.

## 7. The learner loop

- **Mastery per objective:** new → learning → shaky → solid, from check answers, teach-back
  coverage and flashcard ratings. It drives the mind map's colours.
- **A miss** plays an alternate span, then a fresh question on the same objective (generated on
  demand from the alternate if needed). Two misses mark the objective shaky and queue it for review.
- **Teach-back:** browser recorder → WAV encoded in the browser (16 kHz mono; the API takes WAV
  only) → upload → Muse Voice Transcribe (`POST /asr/transcribe`, `PUSH_TO_TALK`) → grader returns
  `{covered[], missing[], misconceptions[]}`, each tied to an objective and a span. Missing points
  become review items and offer "rewatch" on the exact clip.
- **Review:** `ts-fsrs` schedules flashcards and objective checks; a review session interleaves
  concepts.

## 8. Data model (first cut)

| Table | Holds |
|---|---|
| `courses` | topic, goal, level, budget, status, plan JSON, share slug |
| `concepts`, `concept_edges` | modules and concepts, prerequisite graph |
| `objectives` | per concept, with must-include points |
| `videos` | YouTube metadata cache |
| `transcripts` | timed lines per video, cached forever |
| `spans` | objective, video, start, end, rank (chosen or alternate), verification result |
| `recall_items` | type, prompt, answer, distractors, evidence, check results |
| `learners` | anonymous id |
| `attempts` | learner × item: answer, correct, time taken |
| `teachbacks` | learner × module: audio reference, transcript, grading JSON |
| `reviews` | learner × item: FSRS state |
| `build_jobs` | course × step: progress, tokens, cost, errors |

## 9. Scope

**Must (the demo depends on it)**

- The whole build pipeline: plan, discover, transcripts, locate, verify, merge, recall, assemble.
- Course player: clips through the embed, check questions between them, "explain it differently"
  on a miss.
- Teach-back by voice, graded, with clip links.
- Flashcards.
- Mind map with mastery colours.
- Live deployment with 3 pre-built demo courses.

**Should**

- FSRS review queue.
- Placement check: one question per module up front; modules the learner already knows are compressed.
- Live build progress in the UI.

**Stretch (only if every Must is solid by the end of day 7)**

1. **Creator import.** An educator signs in with their Facebook Page or Instagram professional
   account, and Shifu builds a course from their own videos. Muse Voice Transcribe supplies the
   timestamps (turn-level only, so test how fine they are); Facebook embeds play clips with
   `seek()`; Instagram embeds cannot seek, so reels play whole. Development mode with our own
   accounts is enough for the demo; a public launch needs Meta app review.
2. **Diagram flashcards.** Muse Image draws a labelled diagram of a concept from the clips; SAM 3.1
   masks the labels; the learner names each part.

## 10. Schedule

Dates are Sydney time (AEDT). Live sessions are at 12:00 PM ET, which is 3:00 AM here: watch live
or catch the recording if one is posted. Office hours (Discord, text only) are weekdays 10–11 AM ET:
1–2 AM AEDT until 1 Nov, then 2–3 AM after US clocks change.

| Day | Date | Build | Done when |
|---|---|---|---|
| 1 | Tue 27 Oct | Accounts and keys (Meta Model API, YouTube Data API, transcript vendor, Vercel, Postgres); request partner credits; Muse Code reviews this plan; Next.js skeleton. **Spikes:** Muse Spark 1.3 structured output; one Baseten call; transcript vendor on 10 videos; Muse Voice Transcribe on a browser recording (check accepted audio formats) | every spike returns real output; vendor chosen |
| 2 | Wed 28 Oct | Shared types and a fixture course; model router; plan step; discover and transcripts with caching; schema and migrations | topic → outline plus candidate videos with transcripts in the database; Muse Code started on its two modules |
| 3 | Thu 29 Oct | Locate (fan-out), verify, merge. Eval: hand-pick the best span for 10 objectives across the 3 demo topics and compare | at least 7 of 10 chosen spans acceptable |
| 4 | Fri 30 Oct | Course player (timeline, embed with start and end, check blocks); recall generation with both checks; merge Muse Code's two modules | one full module playable end to end |
| 5 | Sat 31 Oct | Learner loop: answers, mastery, "explain it differently"; wire Muse Code's mind map to real mastery | a missed question plays a different creator |
| 6 | Sun 1 Nov | Teach-back: recorder, transcription, grading UI; flashcards | a spoken explanation is graded with rewatch links |
| 7 | Mon 2 Nov | Deploy; rate limits and daily cap; pre-build the 3 demo courses; review queue on Muse Code's FSRS module; fix what the demo courses expose | the live URL works for a stranger with no sign-up |
| 8 | Tue 3 Nov | Feature freeze (stretch work only if everything above is solid); README, including exactly what Muse Code did; demo script. Last day of organiser support: Tue 3 Nov ET, which runs to about 4 PM Wed 4 Nov AEDT | README done; video script locked |
| 9 | Wed 4 Nov | Record and edit the 3-minute video; final fixes; make the repo public; draft the submission | video uploaded and its link checked |
| 10 | Thu 5 Nov | **Submit by 10:00 AM AEDT**, three hours before the 1:00 PM deadline | submitted; repo public; video plays when logged out |

## 11. Demo video (3:00)

| Time | Shows |
|---|---|
| 0:00–0:20 | The problem: 40 videos on one topic, no structure, no idea what stuck |
| 0:20–0:45 | Type a topic → outline and mind map appear; module 1 builds (sped up) |
| 0:45–1:30 | Learn: clip → check question → miss → a different creator explains it → correct |
| 1:30–2:10 | Teach it back by voice → covered and missing points → rewatch the exact moment |
| 2:10–2:35 | The mind map turns green; review queue; flashcards |
| 2:35–3:00 | How it works: which Meta model does what, the verification checks, built in 9 days |

## 12. Risks

| Risk | Plan |
|---|---|
| YouTube search quota (about 100 searches a day) | cache; one search per concept; pre-built demo courses; quota increase requested on day 1 |
| Transcript vendor fails or is slow | 10-video test on day 1; `transcript()` stays swappable; cache everything |
| Baseten credits not approved | router falls back to Muse Spark 1.3 on Meta Model API, then Modal; spend tracked per course in `build_jobs` |
| Meta credits link late; a card is required | add a card with a spend limit as soon as the link opens |
| Course build too slow | module 1 first; streamed progress; pre-built demo courses |
| Poor span choices | the day-3 eval; verification drops bad spans; alternates cover gaps |
| Muse Spark Open's structured output on Baseten | validate with zod; retry once with the error |
| Rights | captions only, never media; caption text never shown; every clip credited and linked |
| Looks like an "education chatbot" | no chat UI anywhere; the demo leads with the course and the verification |

## 13. Open decisions

- **Judging rubric and prize tables:** they did not survive the paste of the participant guide.
  Paste them in to check the demo against the Indie criteria.
- **Team:** solo, or up to 4 (the Indie track is described as "for individual builders and students").
- **Transcript vendor:** SearchAPI recommended (compared 27 Oct, vendor pages only, nothing tested
  live): choice of auto or manual captions, 100 free requests then $40 for 10,000, only successful
  requests billed, an SLA and a status page, no AI transcription that could run up charges, and
  YouTube search on the same key. Runner-up: Supadata ($17 for 3,000), always with `mode=native`,
  because its default transcribes caption-less videos with AI and bills per minute.
- **Postgres host:** Railway (familiar) or Neon from the Vercel Marketplace.
- **The 3 demo topics.** Proposal: Bayes' theorem, attention in transformers, chord progressions in
  music theory. They cover visual, verbal and auditory teaching, and none is near the anti-project list.

## 14. Do today

- [ ] Request Modal credits (first 1,000 people) and Baseten credits (Appendix A); Fireworks for the team.
- [ ] Claim the $150 Meta Model API credits when the link opens; add a card and a spend limit.
- [ ] Join the Discord and post in #intros.
- [ ] New Google Cloud project → YouTube Data API key; apply for a quota increase.
- [ ] Choose the transcript vendor.
- [ ] Install Muse Code (`curl -fsSL https://dev.meta.ai/install.sh | bash`) and pick a plan. The
      $5 Everyday plan (10–50 prompts per 5 hours) is probably enough for a plan review and two
      small modules. Ask in #office-hours whether the $150 Meta Model API credits cover Muse Code;
      its page doesn't say.

## Appendix A: Baseten credit request

**What are you building and how will you use Baseten?**

> I'm building Shifu: type a topic and it designs a structured course (modules, concepts, learning
> objectives), then finds the moment in a YouTube video that best teaches each objective and plays
> those clips through the official embed, mixed in with recall practice: check questions right
> after each clip, flashcards whose answer is the moment in the video, and a "teach it back" step
> where the student explains the idea aloud and is graded against what was said. Missed items go
> into spaced repetition and pull a different video's explanation of the same idea.
>
> I'll run Muse Spark Open (`meta-models/muse-spark-open-1026`) on Baseten for the high-volume
> work: reading every candidate video's timestamped transcript for each concept to find the span
> that teaches each objective, then writing recall items for every clip and checking each one by
> having the model answer it from the clip alone. One course fans out into hundreds of parallel
> calls across concepts and candidate videos, which is why I need the 2M TPM limit. Meta Model API
> handles course planning, grading and speech transcription.

## Appendix B: Hackathon reference

- Event: https://cerebralvalley.ai/e/meta-ai-developer-hackathon
- Discord: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/discord
- Live stream: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/live
- Submit: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit
- Meta docs: https://dev.meta.ai/docs/overview · models: https://dev.meta.ai/docs/models ·
  video input: https://dev.meta.ai/docs/video-understanding
- Cookbooks: https://github.com/meta-models/meta-model-cookbook ·
  https://github.com/meta-models/meta-oss-cookbook
- Baseten credits form: https://docs.google.com/forms/d/e/1FAIpQLSfM7gcK8yMZEmAGq6DbTyiuv2c71IH7CKCy0fXGIfUED1qxVQ/viewform
- Modal credits form: https://docs.google.com/forms/d/e/1FAIpQLSe_GDPtLZsdA57xPhFcOCi_yLjPf8HRxMIQJ5V7ystoKSqWCQ/viewform
- Fireworks credits form: https://docs.google.com/forms/d/e/1FAIpQLSdPQTTES8_nhavzZkOrebVNYbM1FumWLdpeZx8ZSNe4QLXKPA/viewform

**Submission checklist:** public repo; 3-minute demo video showing only hackathon-built features;
everyone who worked on it listed; one representative submits for the team.

**Judging:** stage 1 pass/fail (fits a theme, uses Meta's models); stage 2 scores 0–10 on equally
weighted criteria; stage 3 the top 5 per track are ranked by judges watching the videos live.
Finals and winners: Mon 9 Nov 12:00 PM ET (Tue 10 Nov, 4:00 AM AEDT).
