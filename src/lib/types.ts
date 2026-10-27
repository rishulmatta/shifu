// The shared shapes of Shifu: what the build pipeline produces, what the player renders and what
// the learner's progress records. PLAN.md §3 (the learner's path), §6 (the pipeline), §7 (mastery).

/** kebab-case, unique within a course, e.g. "bayes-rule". */
export type ConceptId = string;
/** `${conceptId}/${n}`, n from 1, e.g. "bayes-rule/2". */
export type ObjectiveId = string;

export type Level = "beginner" | "intermediate" | "advanced";

// ── The plan (Muse Spark designs it; PLAN.md §6 step 1) ──────────────────────────────────────

export interface Objective {
  id: ObjectiveId;
  conceptId: ConceptId;
  /** Something the learner can do: "compute a posterior from a prior and a likelihood". */
  text: string;
  /** The 2–4 points a good explanation of this objective must include. */
  mustInclude: string[];
}

export interface Concept {
  id: ConceptId;
  moduleIndex: number;
  title: string;
  /** One line: why this concept matters, shown before its first clip. */
  why: string;
  /** Concepts this one builds on. Always earlier in the course. */
  prerequisites: ConceptId[];
  objectives: Objective[];
  searchQueries: string[];
}

export interface Module {
  index: number;
  title: string;
  /** In teaching order. */
  conceptIds: ConceptId[];
}

export interface CoursePlan {
  topic: string;
  goal: string;
  level: Level;
  minutesPerDay: number;
  /** The learner's world as the goal describes it ("a stats exam", "marketing at work"), or "". */
  context: string;
  modules: Module[];
  concepts: Concept[];
}

// ── Videos and spans (PLAN.md §6 steps 2–6) ──────────────────────────────────────────────────

export interface Video {
  /** YouTube video id. */
  id: string;
  title: string;
  channel: string;
  durationS: number;
}

/** One caption line, as the transcript API returns it. */
export interface CaptionLine {
  start: number;
  duration: number;
  text: string;
}

/** A stretch of one video that teaches one objective. */
export interface Span {
  id: string;
  objectiveId: ObjectiveId;
  videoId: string;
  /** Seconds. */
  start: number;
  end: number;
  /** 0 is the chosen span; 1 and 2 are alternates from other creators ("explain it differently"). */
  rank: 0 | 1 | 2;
  /** Which of the objective's must-include points the span covers. */
  covers: string[];
  selfContained: boolean;
}

// ── Recall (PLAN.md §6 step 7) ───────────────────────────────────────────────────────────────

/** Where an item's answer comes from. The quote is checked against the captions, never shown. */
export interface Evidence {
  spanId: string;
  quote: string;
}

interface ItemBase {
  id: string;
  objectiveId: ObjectiveId;
  evidence: Evidence;
}

export type RecallItem =
  | (ItemBase & {
      kind: "mcq";
      prompt: string;
      options: string[];
      answerIndex: number;
      explanation: string;
      /**
       * Per option, the misconception it stands for, said to a learner who picked it; "" for the
       * answer. Absent on courses built before 27 Oct.
       */
      whyWrong?: string[];
    })
  | (ItemBase & { kind: "card"; front: string; back: string });

export type CheckItem = Extract<RecallItem, { kind: "mcq" }>;
export type CardItem = Extract<RecallItem, { kind: "card" }>;

// ── The course timeline (PLAN.md §3) ─────────────────────────────────────────────────────────

export type Block =
  | { kind: "intro"; conceptId: ConceptId }
  | { kind: "clip"; objectiveId: ObjectiveId; spanId: string }
  | { kind: "check"; objectiveId: ObjectiveId; itemId: string }
  | { kind: "cards"; conceptId: ConceptId; itemIds: string[] }
  | { kind: "teachback"; moduleIndex: number }
  | { kind: "quiz"; moduleIndex: number; itemIds: string[] };

export type CourseStatus = "planning" | "building" | "ready" | "failed";

export interface Course {
  id: string;
  /** URL slug: /c/<slug>. */
  slug: string;
  status: CourseStatus;
  plan: CoursePlan;
  videos: Record<string, Video>;
  spans: Span[];
  items: RecallItem[];
  timeline: Block[];
}

// ── Mastery and progress (PLAN.md §7) ────────────────────────────────────────────────────────

export type MasteryState = "new" | "learning" | "shaky" | "solid";

export interface ObjectiveProgress {
  objectiveId: ObjectiveId;
  state: MasteryState;
  /** An unaided correct answer since the last lapse. */
  correct: boolean;
  /** Confirmed since the last lapse: covered in a teach-back, or passed a spaced review. */
  confirmed: boolean;
  /** Wrong check answers in a row. */
  missStreak: number;
}

/** How sure the learner was, given with every answer (PLAN.md §3, "Teaching that works"). */
export type Confidence = "guess" | "think" | "sure";

export type MasteryEvent =
  /** `unaided`: answered without a re-explanation just before (first try in a lesson, quiz, review). */
  | { kind: "check"; correct: boolean; unaided: boolean; confidence?: Confidence }
  | { kind: "teachback"; verdict: "covered" | "missing" | "misconception" }
  /** A spaced review from the review queue. */
  | { kind: "review"; rating: "again" | "hard" | "good" | "easy" };

/** Where a learner is in a course. */
export interface Position {
  blockIndex: number;
}
