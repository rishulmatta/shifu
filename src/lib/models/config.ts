// Every model id, price and per-task provider chain lives here (PLAN.md §5). The router tries a
// task's chain in order, skipping providers whose key is missing.

export type ProviderId = "meta" | "baseten";

export interface Provider {
  id: ProviderId;
  baseUrl: string;
  keyEnv: string;
  /** Whether the provider is known to accept `reasoning_effort`. */
  effort: boolean;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  meta: { id: "meta", baseUrl: "https://api.meta.ai/v1", keyEnv: "META_MODEL_API_KEY", effort: false },
  baseten: {
    id: "baseten",
    baseUrl: process.env.BASETEN_BASE_URL ?? "https://inference.baseten.co/v1",
    keyEnv: "BASETEN_API_KEY",
    effort: true,
  },
};

export const MODELS = {
  spark: "muse-spark-1.3",
  sparkOpen: "meta-models/muse-spark-open-1026",
} as const;

/** US dollars per million tokens: [input, cached input, output]. Reasoning is billed as output. */
export const PRICES: Record<string, [number, number, number]> = {
  [MODELS.spark]: [1.25, 0.15, 4.25],
  [MODELS.sparkOpen]: [1.25, 0.15, 4.25],
};

export type Effort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface Rung {
  provider: ProviderId;
  model: string;
  effort?: Effort;
}

export type Task = "plan" | "locate" | "merge" | "recall" | "answer" | "grade";

/** Which model does each job, in order of preference (PLAN.md §5). */
export const CHAINS: Record<Task, Rung[]> = {
  plan: [
    { provider: "meta", model: MODELS.spark },
    { provider: "baseten", model: MODELS.sparkOpen, effort: "medium" },
  ],
  locate: [
    { provider: "baseten", model: MODELS.sparkOpen, effort: "none" },
    { provider: "meta", model: MODELS.spark },
  ],
  merge: [
    { provider: "meta", model: MODELS.spark },
    { provider: "baseten", model: MODELS.sparkOpen, effort: "low" },
  ],
  recall: [
    { provider: "baseten", model: MODELS.sparkOpen, effort: "low" },
    { provider: "meta", model: MODELS.spark },
  ],
  answer: [
    { provider: "baseten", model: MODELS.sparkOpen, effort: "none" },
    { provider: "meta", model: MODELS.spark },
  ],
  grade: [
    { provider: "meta", model: MODELS.spark },
    { provider: "baseten", model: MODELS.sparkOpen, effort: "medium" },
  ],
};
