// A hand-written sample course for building the UI before the pipeline runs end to end
// (PLAN.md §4, "Contract first"). The videos are real and embeddable (checked with YouTube's
// oEmbed on 27 Oct 2026), but the clip times are illustrative guesses, not chosen from captions,
// and the questions were written by hand. Evidence quotes are empty for the same reason.

import { assembleTimeline } from "../pipeline/assemble";
import type { Course, CoursePlan, RecallItem, Span, Video } from "../types";

const videos: Record<string, Video> = {
  BrK7X_XlGB8: { id: "BrK7X_XlGB8", title: "A visual guide to Bayesian thinking", channel: "Julia Galef", durationS: 685 },
  OqmJhPQYRc8: { id: "OqmJhPQYRc8", title: "Critical thinking fundamentals: Bayes' theorem", channel: "Wireless Philosophy", durationS: 420 },
  "9wCnvr7Xw4E": { id: "9wCnvr7Xw4E", title: "Bayes' Theorem, Clearly Explained!!!!", channel: "StatQuest with Josh Starmer", durationS: 900 },
  U_85TaXbeIo: { id: "U_85TaXbeIo", title: "The quick proof of Bayes' theorem", channel: "3Blue1Brown", durationS: 220 },
  HZGCoVF3YvM: { id: "HZGCoVF3YvM", title: "Bayes theorem, the geometry of changing beliefs", channel: "3Blue1Brown", durationS: 910 },
  lG4VkPoG3ko: { id: "lG4VkPoG3ko", title: "The medical test paradox, and redesigning Bayes' rule", channel: "3Blue1Brown", durationS: 1270 },
  R13BD8qKeTg: { id: "R13BD8qKeTg", title: "The Bayesian Trap", channel: "Veritasium", durationS: 636 },
};

const plan: CoursePlan = {
  topic: "Bayes' theorem",
  goal: "Understand how evidence should change what I believe",
  level: "beginner",
  minutesPerDay: 20,
  modules: [
    { index: 0, title: "Updating beliefs with evidence", conceptIds: ["priors-and-evidence", "bayes-rule"] },
    { index: 1, title: "Bayes in the wild", conceptIds: ["base-rates", "updating-gradually"] },
  ],
  concepts: [
    {
      id: "priors-and-evidence",
      moduleIndex: 0,
      title: "Priors and evidence",
      why: "Every update starts from what you believed before you looked.",
      prerequisites: [],
      searchQueries: ["what is a prior probability", "bayesian thinking evidence"],
      objectives: [
        {
          id: "priors-and-evidence/1",
          conceptId: "priors-and-evidence",
          text: "Explain what a prior is and why you can't reason from evidence without one",
          mustInclude: ["a prior is a belief before the evidence", "the same evidence moves different priors differently"],
        },
        {
          id: "priors-and-evidence/2",
          conceptId: "priors-and-evidence",
          text: "Describe how strong and weak evidence should shift a belief",
          mustInclude: ["evidence is strong when it is much likelier if the hypothesis is true", "weak evidence moves a belief a little"],
        },
      ],
    },
    {
      id: "bayes-rule",
      moduleIndex: 0,
      title: "Bayes' rule",
      why: "One line of arithmetic tells you exactly how far evidence should move you.",
      prerequisites: ["priors-and-evidence"],
      searchQueries: ["bayes theorem explained", "bayes rule geometry"],
      objectives: [
        {
          id: "bayes-rule/1",
          conceptId: "bayes-rule",
          text: "Compute a posterior from a prior and a likelihood",
          mustInclude: ["multiply the prior by the likelihood", "divide by the overall probability of the evidence"],
        },
        {
          id: "bayes-rule/2",
          conceptId: "bayes-rule",
          text: "Read Bayes' rule as a share of an area",
          mustInclude: ["the hypothesis takes up part of the space", "evidence restricts the space", "the posterior is the share left"],
        },
      ],
    },
    {
      id: "base-rates",
      moduleIndex: 1,
      title: "Base rates",
      why: "Ignoring how common something is makes accurate tests look far more certain than they are.",
      prerequisites: ["bayes-rule"],
      searchQueries: ["base rate fallacy", "bayes factor odds"],
      objectives: [
        {
          id: "base-rates/1",
          conceptId: "base-rates",
          text: "Explain why a positive result from an accurate test can still be unlikely to be right",
          mustInclude: ["the condition is rare", "false positives outnumber true positives"],
        },
        {
          id: "base-rates/2",
          conceptId: "base-rates",
          text: "Update odds with a Bayes factor",
          mustInclude: ["prior odds", "the Bayes factor is the likelihood ratio", "posterior odds = prior odds × Bayes factor"],
        },
      ],
    },
    {
      id: "updating-gradually",
      moduleIndex: 1,
      title: "Updating gradually",
      why: "Good thinkers change their minds in steps, not leaps.",
      prerequisites: ["base-rates"],
      searchQueries: ["bayesian trap", "bayesian updating everyday life"],
      objectives: [
        {
          id: "updating-gradually/1",
          conceptId: "updating-gradually",
          text: "Explain why repeated evidence should move a belief step by step",
          mustInclude: ["each posterior becomes the next prior", "a prior of zero can never move"],
        },
      ],
    },
  ],
};

const span = (objectiveId: string, rank: 0 | 1 | 2, videoId: string, start: number, end: number): Span => ({
  id: `${objectiveId}#${rank}`,
  objectiveId,
  videoId,
  start,
  end,
  rank,
  covers: [],
  selfContained: true,
});

const spans: Span[] = [
  span("priors-and-evidence/1", 0, "BrK7X_XlGB8", 60, 170),
  span("priors-and-evidence/1", 1, "OqmJhPQYRc8", 40, 150),
  span("priors-and-evidence/2", 0, "BrK7X_XlGB8", 170, 290),
  span("priors-and-evidence/2", 1, "R13BD8qKeTg", 60, 170),
  span("bayes-rule/1", 0, "9wCnvr7Xw4E", 120, 260),
  span("bayes-rule/1", 1, "U_85TaXbeIo", 0, 80),
  span("bayes-rule/2", 0, "HZGCoVF3YvM", 330, 520),
  span("bayes-rule/2", 1, "OqmJhPQYRc8", 150, 280),
  span("base-rates/1", 0, "lG4VkPoG3ko", 60, 240),
  span("base-rates/1", 1, "R13BD8qKeTg", 170, 330),
  span("base-rates/2", 0, "lG4VkPoG3ko", 480, 700),
  span("base-rates/2", 1, "BrK7X_XlGB8", 400, 520),
  span("updating-gradually/1", 0, "R13BD8qKeTg", 420, 600),
  span("updating-gradually/1", 1, "BrK7X_XlGB8", 560, 680),
];

let n = 0;
const mcq = (objectiveId: string, prompt: string, options: string[], answerIndex: number, explanation: string): RecallItem => ({
  id: `item-${++n}`,
  kind: "mcq",
  objectiveId,
  prompt,
  options,
  answerIndex,
  explanation,
  evidence: { spanId: `${objectiveId}#0`, quote: "" },
});
const card = (objectiveId: string, front: string, back: string): RecallItem => ({
  id: `item-${++n}`,
  kind: "card",
  objectiveId,
  front,
  back,
  evidence: { spanId: `${objectiveId}#0`, quote: "" },
});

const items: RecallItem[] = [
  mcq("priors-and-evidence/1", "What is a prior?", ["The evidence you collect", "What you believed before seeing the evidence", "The probability of the evidence", "The final answer"], 1, "A prior is your belief before the new evidence arrives."),
  mcq("priors-and-evidence/1", "Two people see the same evidence but end up with different beliefs. The most likely reason?", ["One of them miscalculated", "They started from different priors", "The evidence was false", "Evidence can't change beliefs"], 1, "The same evidence moves different priors to different places."),
  mcq("priors-and-evidence/1", "Why can't you judge evidence without a prior?", ["Evidence only says how much to shift, not where to start", "Priors are always 50%", "Evidence is always weak", "You can, priors are optional"], 0, "Evidence tells you how far to move; the prior says where you start."),
  mcq("priors-and-evidence/2", "When is evidence strong for a hypothesis?", ["When it is surprising", "When it is much likelier if the hypothesis is true than if it is false", "When many people believe it", "When it is recent"], 1, "Strength is the ratio of how likely the evidence is under each hypothesis."),
  mcq("priors-and-evidence/2", "Evidence that is about as likely whether or not the hypothesis is true should…", ["Barely move your belief", "Double your belief", "Make you certain", "Reverse your belief"], 0, "If both sides predict it equally, it carries almost no information."),
  mcq("bayes-rule/1", "Prior 10%, likelihood of the evidence if true 80%, overall chance of the evidence 20%. The posterior?", ["8%", "16%", "40%", "80%"], 2, "0.10 × 0.80 ÷ 0.20 = 0.40."),
  mcq("bayes-rule/1", "In Bayes' rule, what do you divide by?", ["The prior", "The likelihood", "The overall probability of the evidence", "One minus the prior"], 2, "Dividing by P(evidence) keeps the posterior a proper probability."),
  mcq("bayes-rule/1", "If the evidence is certain whether or not the hypothesis holds, the posterior equals…", ["Zero", "The prior", "One", "The likelihood"], 1, "Evidence everyone expects can't change your belief."),
  mcq("bayes-rule/2", "In the area picture, what does seeing the evidence do?", ["Adds new area", "Restricts you to the region where the evidence holds", "Removes the hypothesis", "Nothing"], 1, "You zoom in on the part of the space consistent with the evidence."),
  mcq("bayes-rule/2", "The posterior in the area picture is…", ["The hypothesis's share of the region left after the evidence", "The whole area", "The area outside the evidence", "The prior's area"], 0, "It's the fraction of the restricted region where the hypothesis is true."),
  mcq("base-rates/1", "A test is 90% accurate and the condition affects 1 in 1,000 people. After a positive result, is having it likely?", ["Yes, 90%", "Yes, about 50%", "No, it's still under 1%", "Exactly 10%"], 2, "False positives from the 999 healthy people swamp the one true positive."),
  mcq("base-rates/1", "Why do false positives matter so much for rare conditions?", ["They're more common than true positives", "Tests are never accurate", "Rare conditions have no symptoms", "They don't"], 0, "With a low base rate, even a small false-positive rate produces more false alarms than real cases."),
  mcq("base-rates/2", "Prior odds 1:99, Bayes factor 10. Posterior odds?", ["10:99", "1:990", "10:9", "1:9.9"], 0, "Multiply the prior odds by the Bayes factor: 1×10 : 99."),
  mcq("base-rates/2", "The Bayes factor of a test is…", ["The prior odds", "The ratio of the true-positive rate to the false-positive rate", "The base rate", "The posterior probability"], 1, "It's the likelihood ratio: how much likelier a positive is if you have it."),
  mcq("updating-gradually/1", "After one update, what becomes your new prior?", ["The old prior", "The posterior you just computed", "50%", "The likelihood"], 1, "Each posterior becomes the starting point for the next piece of evidence."),
  mcq("updating-gradually/1", "Why can a belief held at 0% never change?", ["Zero times any likelihood is still zero", "Evidence is ignored", "It always changes", "Zero means unknown"], 0, "Bayes' rule multiplies by the prior, so a zero prior stays zero."),
  card("priors-and-evidence/1", "Prior", "What you believed before seeing the new evidence."),
  card("priors-and-evidence/2", "When is evidence strong?", "When it's much likelier if the hypothesis is true than if it's false."),
  card("bayes-rule/1", "Bayes' rule in words", "Posterior = prior × likelihood ÷ probability of the evidence."),
  card("bayes-rule/2", "The posterior as an area", "The hypothesis's share of the region where the evidence holds."),
  card("base-rates/1", "Base-rate fallacy", "Judging a positive result by test accuracy alone, ignoring how rare the condition is."),
  card("base-rates/2", "Odds form of Bayes", "Posterior odds = prior odds × Bayes factor."),
  card("updating-gradually/1", "Why never hold 0% or 100%?", "Those priors can't be moved by any evidence."),
];

export const bayesCourse: Course = {
  id: "fixture-bayes",
  slug: "bayes-sample",
  status: "ready",
  plan,
  videos,
  spans,
  items,
  timeline: assembleTimeline(plan, spans, items),
};
