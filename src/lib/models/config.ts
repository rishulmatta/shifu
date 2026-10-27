// Every model id, price and per-task provider chain lives here (PLAN.md §5). The router tries a
// task's chain in order, skipping providers whose key or endpoint URL is missing.

export type ProviderId = "meta" | "baseten" | "modal";

export interface Provider {
  id: ProviderId;
  /** Used when `urlEnv` is unset or empty. */
  baseUrl: string;
  urlEnv?: string;
  keyEnv: string;
  /** Whether the provider is known to accept `reasoning_effort`. */
  effort: boolean;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  meta: { id: "meta", baseUrl: "https://api.meta.ai/v1", keyEnv: "META_MODEL_API_KEY", effort: false },
  baseten: {
    id: "baseten",
    baseUrl: "https://inference.baseten.co/v1",
    urlEnv: "BASETEN_BASE_URL",
    keyEnv: "BASETEN_API_KEY",
    effort: true,
  },
  // A Modal Shared Endpoint: each workspace gets its own URL (set MODAL_BASE_URL to it plus /v1),
  // and the key is a proxy token, "wk-<id>.ws-<secret>".
  modal: { id: "modal", baseUrl: "", urlEnv: "MODAL_BASE_URL", keyEnv: "MODAL_PROXY_TOKEN", effort: true },
};

export const baseUrlOf = (p: Provider) => (p.urlEnv && process.env[p.urlEnv]) || p.baseUrl;

/** A provider is usable when it has a key and an endpoint to send it to. */
export const isReady = (p: Provider) => Boolean(process.env[p.keyEnv] && baseUrlOf(p));

export const MODELS = {
  spark: "muse-spark-1.3",
  sparkOpen: "meta-models/muse-spark-open-1026",
  sparkOpenModal: "meta-models/Muse-Spark-Open-816B-A42B",
} as const;

/** US dollars per million tokens: [input, cached input, output]. Reasoning is billed as output. */
export const PRICES: Record<string, [number, number, number]> = {
  [MODELS.spark]: [1.25, 0.15, 4.25],
  [MODELS.sparkOpen]: [1.25, 0.15, 4.25],
  [MODELS.sparkOpenModal]: [1.25, 0.15, 4.25],
};

export type Effort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface Rung {
  provider: ProviderId;
  model: string;
  effort?: Effort;
}

export type Task = "plan" | "locate" | "merge" | "recall" | "answer" | "grade" | "transcribe";

/** Muse Spark Open at one effort: Baseten first, then Modal (the same weights, billed per token). */
const open = (effort: Effort): Rung[] => [
  { provider: "baseten", model: MODELS.sparkOpen, effort },
  { provider: "modal", model: MODELS.sparkOpenModal, effort },
];

const spark: Rung = { provider: "meta", model: MODELS.spark };

/** Which model does each job, in order of preference (PLAN.md §5). */
export const CHAINS: Record<Task, Rung[]> = {
  plan: [spark, ...open("medium")],
  locate: [...open("none"), spark],
  merge: [spark, ...open("low")],
  recall: [...open("low"), spark],
  answer: [...open("none"), spark],
  grade: [spark, ...open("medium")],
  // Muse Spark Open takes audio input; Muse Voice Transcribe on Meta, when its key is set, goes first
  // (transcribe.ts), because it is a dedicated speech model at $0.18 an hour.
  transcribe: open("none"),
};
