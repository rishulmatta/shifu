// A hand-written sample course for building the UI before the pipeline runs end to end
// (PLAN.md §4, "Contract first"). The videos are real and embeddable (checked with YouTube's
// oEmbed on 27 Oct 2026), but the clip times are illustrative guesses, not chosen from captions,
// and the questions (with the misconception behind each wrong option) were written by hand.
// Evidence quotes are empty for the same reason.

import { assembleTimeline } from "../pipeline/assemble";
import type { Challenge, Course, CoursePlan, RecallItem, Span, Video } from "../types";

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
  context: "",
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
const mcq = (objectiveId: string, prompt: string, options: string[], answerIndex: number, explanation: string, whyWrong: string[]): RecallItem => ({
  id: `item-${++n}`,
  kind: "mcq",
  objectiveId,
  prompt,
  options,
  answerIndex,
  explanation,
  whyWrong,
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
  mcq("priors-and-evidence/1", "What is a prior?", ["The evidence you collect", "What you believed before seeing the evidence", "The probability of the evidence", "The final answer"], 1, "A prior is your belief before the new evidence arrives.", [
    "That's the data itself. The prior is what you believed before the data arrived.",
    "",
    "That's how likely the evidence is overall (the bottom of Bayes' rule), not your starting belief.",
    "That's the posterior: where you end up after the evidence, not where you start.",
  ]),
  mcq("priors-and-evidence/1", "Two people see the same evidence but end up with different beliefs. The most likely reason?", ["One of them miscalculated", "They started from different priors", "The evidence was false", "Evidence can't change beliefs"], 1, "The same evidence moves different priors to different places.", [
    "Both can calculate correctly: the same update applied to different starting points lands in different places.",
    "",
    "Nothing says the evidence was false; even true evidence leaves different priors in different places.",
    "Evidence does change beliefs; it moves each person from wherever they started.",
  ]),
  mcq("priors-and-evidence/1", "Why can't you judge evidence without a prior?", ["Evidence only says how much to shift, not where to start", "Priors are always 50%", "Evidence is always weak", "You can, priors are optional"], 0, "Evidence tells you how far to move; the prior says where you start.", [
    "",
    "A prior can be anything. Assuming 50% is itself a prior, and often a bad one.",
    "Evidence can be strong, but even strong evidence needs a starting point to move from.",
    "Skipping the prior doesn't remove it: you end up using one without noticing.",
  ]),
  mcq("priors-and-evidence/2", "When is evidence strong for a hypothesis?", ["When it is surprising", "When it is much likelier if the hypothesis is true than if it is false", "When many people believe it", "When it is recent"], 1, "Strength is the ratio of how likely the evidence is under each hypothesis.", [
    "Surprise alone isn't enough: what matters is whether the hypothesis makes it much likelier than the alternative does.",
    "",
    "That's popularity, not evidence. Strength comes from how differently the hypotheses predict it.",
    "Recency doesn't change how well the evidence tells the hypotheses apart.",
  ]),
  mcq("priors-and-evidence/2", "Evidence that is about as likely whether or not the hypothesis is true should…", ["Barely move your belief", "Double your belief", "Make you certain", "Reverse your belief"], 0, "If both sides predict it equally, it carries almost no information.", [
    "",
    "Doubling your odds needs evidence about twice as likely under the hypothesis; here the ratio is about 1.",
    "Certainty needs evidence that's impossible under the alternative; this is equally likely under both.",
    "To push you the other way, the evidence would have to be likelier if the hypothesis were false.",
  ]),
  mcq("bayes-rule/1", "Prior 10%, likelihood of the evidence if true 80%, overall chance of the evidence 20%. The posterior?", ["8%", "16%", "40%", "80%"], 2, "0.10 × 0.80 ÷ 0.20 = 0.40.", [
    "That's prior × likelihood without dividing by the overall chance of the evidence.",
    "That multiplies the likelihood by the chance of the evidence; Bayes' rule multiplies by the prior and divides by the evidence.",
    "",
    "That's the likelihood: the chance of the evidence if the hypothesis is true, not the chance of the hypothesis given the evidence.",
  ]),
  mcq("bayes-rule/1", "In Bayes' rule, what do you divide by?", ["The prior", "The likelihood", "The overall probability of the evidence", "One minus the prior"], 2, "Dividing by P(evidence) keeps the posterior a proper probability.", [
    "The prior is multiplied in, not divided by.",
    "The likelihood is multiplied in too; the division scales by how likely the evidence is overall.",
    "",
    "One minus the prior is the chance the hypothesis is false. It appears inside P(evidence), not on its own.",
  ]),
  mcq("bayes-rule/1", "If the evidence is certain whether or not the hypothesis holds, the posterior equals…", ["Zero", "The prior", "One", "The likelihood"], 1, "Evidence everyone expects can't change your belief.", [
    "Evidence that's certain either way can't rule the hypothesis out.",
    "",
    "A likelihood of 1 doesn't make the hypothesis certain, because the evidence was certain anyway.",
    "The likelihood is 1 here, but the posterior is the prior × 1 ÷ 1.",
  ]),
  mcq("bayes-rule/2", "In the area picture, what does seeing the evidence do?", ["Adds new area", "Restricts you to the region where the evidence holds", "Removes the hypothesis", "Nothing"], 1, "You zoom in on the part of the space consistent with the evidence.", [
    "Evidence never adds possibilities; it rules some out.",
    "",
    "The hypothesis survives wherever it overlaps the evidence; only the rest is ruled out.",
    "Evidence always narrows the space, even when the hypothesis's share happens to stay the same.",
  ]),
  mcq("bayes-rule/2", "The posterior in the area picture is…", ["The hypothesis's share of the region left after the evidence", "The whole area", "The area outside the evidence", "The prior's area"], 0, "It's the fraction of the restricted region where the hypothesis is true.", [
    "",
    "The whole area is everything before the evidence; the posterior only looks inside what's left.",
    "That's the part the evidence ruled out. The posterior lives inside the evidence region.",
    "The prior is the hypothesis's share before the evidence; the posterior is its share after.",
  ]),
  mcq("base-rates/1", "A test is 90% accurate and the condition affects 1 in 1,000 people. After a positive result, is having it likely?", ["Yes, 90%", "Yes, about 50%", "No, it's still under 1%", "Exactly 10%"], 2, "False positives from the 999 healthy people swamp the one true positive.", [
    "90% is the chance of a positive if you're ill, not the chance you're ill after a positive. It ignores how rare the condition is.",
    "A coin flip feels fair, but the 999 healthy people produce about 100 false positives against one real case.",
    "",
    "10% is the false-positive rate, not the chance you have it.",
  ]),
  mcq("base-rates/1", "Why do false positives matter so much for rare conditions?", ["They're more common than true positives", "Tests are never accurate", "Rare conditions have no symptoms", "They don't"], 0, "With a low base rate, even a small false-positive rate produces more false alarms than real cases.", [
    "",
    "The test can be quite accurate; the problem is how many healthy people it's applied to.",
    "Symptoms aren't part of this: it's the arithmetic of a small base rate.",
    "They do: with a rare condition, false alarms can outnumber real cases many times over.",
  ]),
  mcq("base-rates/2", "Prior odds 1:99, Bayes factor 10. Posterior odds?", ["10:99", "1:990", "10:1", "11:99"], 0, "Multiply the prior odds by the Bayes factor: 1×10 : 99.", [
    "",
    "That divides the hypothesis's side by the Bayes factor; the odds form multiplies it.",
    "That's the Bayes factor on its own, as if the prior odds didn't matter.",
    "That adds the Bayes factor to the odds; the odds form multiplies.",
  ]),
  mcq("base-rates/2", "The Bayes factor of a test is…", ["The prior odds", "The ratio of the true-positive rate to the false-positive rate", "The base rate", "The posterior probability"], 1, "It's the likelihood ratio: how much likelier a positive is if you have it.", [
    "Prior odds are where you start; the Bayes factor is how far the test moves them.",
    "",
    "The base rate is how common the condition is. It sets the prior, not the test's strength.",
    "The posterior is the result; the Bayes factor is what you multiply by to get there.",
  ]),
  mcq("updating-gradually/1", "After one update, what becomes your new prior?", ["The old prior", "The posterior you just computed", "50%", "The likelihood"], 1, "Each posterior becomes the starting point for the next piece of evidence.", [
    "Going back to the old prior throws away the evidence you've just used.",
    "",
    "Resetting to 50% ignores everything you've learned so far.",
    "The likelihood describes the evidence, not your belief after it.",
  ]),
  mcq("updating-gradually/1", "Why can a belief held at 0% never change?", ["Zero times any likelihood is still zero", "Evidence is ignored", "It always changes", "Zero means unknown"], 0, "Bayes' rule multiplies by the prior, so a zero prior stays zero.", [
    "",
    "The evidence is used; it's the multiplication by zero that stops it having any effect.",
    "Bayes' rule multiplies by the prior, so a prior of zero stays zero whatever you see.",
    "0% isn't \"unknown\": it's certainty that the hypothesis is false.",
  ]),
  card("priors-and-evidence/1", "Prior", "What you believed before seeing the new evidence."),
  card("priors-and-evidence/2", "When is evidence strong?", "When it's much likelier if the hypothesis is true than if it's false."),
  card("bayes-rule/1", "Bayes' rule in words", "Posterior = prior × likelihood ÷ probability of the evidence."),
  card("bayes-rule/2", "The posterior as an area", "The hypothesis's share of the region where the evidence holds."),
  card("base-rates/1", "Base-rate fallacy", "Judging a positive result by test accuracy alone, ignoring how rare the condition is."),
  card("base-rates/2", "Odds form of Bayes", "Posterior odds = prior odds × Bayes factor."),
  card("updating-gradually/1", "Why never hold 0% or 100%?", "Those priors can't be moved by any evidence."),
];

/** Hand-written, in the shape the challenge step produces (PLAN.md §6, step 1b). */
const challenges: Challenge[] = [
  {
    id: "challenge-1",
    prompt:
      "A friend shows you 100 cards: 20 red and 80 blue. 15 of the red cards and 20 of the blue ones have a star on the back. You're handed a card with a star. How likely is it to be red?",
    options: ["About 43%", "About 20%", "About 75%", "About 15%"],
    answerIndex: 0,
    whyWrong: [
      "",
      "That's the share of red cards before you saw the star: the star is evidence you left out.",
      "That's the share of red cards with a star, the condition the wrong way round.",
      "That's red-and-starred out of all 100 cards, not out of the 35 starred ones.",
    ],
    explanation: "Of the 35 starred cards, 15 are red: 15 out of 35 is about 43%.",
    objectiveIds: ["bayes-rule/2", "priors-and-evidence/1"],
  },
  {
    id: "challenge-2",
    prompt:
      "1% of people have a virus. A test is positive for 9 in 10 people who have it and for 1 in 10 who don't. You test positive. How likely is it that you have the virus?",
    options: ["About 90%", "About 8%", "About 1%", "About 50%"],
    answerIndex: 1,
    whyWrong: [
      "That's how often the test catches the virus, not how likely you are to have it after a positive.",
      "",
      "That's the chance before the test: a positive result is real evidence.",
      "A positive doesn't make it even odds; the many healthy people produce most of the positives.",
    ],
    explanation: "Out of 1,000 people, 9 of the 10 with the virus test positive and so do about 99 of the 990 without it: 9 in 108, about 8%.",
    objectiveIds: ["base-rates/1", "bayes-rule/1"],
  },
  {
    id: "challenge-3",
    prompt:
      "1 email in 10 is spam, so the odds an email is spam start at 1 to 9. A filter flags spam 4 times as often as normal mail. An email gets flagged. What are the odds it's spam now?",
    options: ["4 to 1", "1 to 9", "4 to 9", "5 to 9"],
    answerIndex: 2,
    whyWrong: [
      "That's the Bayes factor alone, with the starting odds dropped.",
      "That's the starting odds, as if the flag told you nothing.",
      "",
      "That adds the Bayes factor to the starting odds instead of multiplying.",
    ],
    explanation: "Posterior odds are the prior odds times the Bayes factor: 1 to 9 times 4 is 4 to 9.",
    objectiveIds: ["base-rates/2", "priors-and-evidence/2"],
  },
  {
    id: "challenge-4",
    prompt:
      "You start 10% sure a coin is biased towards heads. A long run of heads moves you to 30%. Then a second, similar run of heads comes in. What should your belief do?",
    options: [
      "Jump to 100%: two runs prove it",
      "Go back to 10% and update to 30% again",
      "Stay at 30%: the second run adds nothing",
      "Start from 30% and move higher",
    ],
    answerIndex: 3,
    whyWrong: [
      "Two pieces of evidence make it more likely, not certain.",
      "That throws away what the first run already told you.",
      "A second run is new evidence, so it should move you further.",
      "",
    ],
    explanation: "Each update's posterior is the next one's prior, so the second run starts from 30% and pushes higher.",
    objectiveIds: ["updating-gradually/1", "priors-and-evidence/2"],
  },
];

export const bayesCourse: Course = {
  id: "fixture-bayes",
  slug: "bayes-sample",
  status: "ready",
  plan,
  videos,
  spans,
  items,
  challenges,
  timeline: assembleTimeline(plan, spans, items, { before: true, after: true }),
};
