// Every model id, price and per-task provider chain lives here (PLAN.md §5). The router tries a
// task's chain in order, skipping providers whose key or endpoint URL is missing.

export type ProviderId = "meta" | "baseten" | "modal";

export interface Provider {
  id: ProviderId;
  /** Used when `urlEnv` is unset or empty. */
  baseUrl: string;
  urlEnv?: string;
  /** The key, or its parts joined with "." (a Modal proxy token is "<id>.<secret>"). */
  keyEnv: string[];
  /** The `reasoning_effort` values it accepts (tested 28 Oct); a rung's effort rounds up to one. */
  efforts: readonly Effort[];
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  meta: {
    id: "meta",
    baseUrl: "https://api.meta.ai/v1",
    keyEnv: ["META_MODEL_API_KEY"],
    efforts: ["minimal", "low", "medium", "high", "xhigh", "max"],
  },
  baseten: {
    id: "baseten",
    baseUrl: "https://inference.baseten.co/v1",
    urlEnv: "BASETEN_BASE_URL",
    keyEnv: ["BASETEN_API_KEY"],
    efforts: ["none", "low", "medium"],
  },
  // A Modal Shared Endpoint: each workspace gets its own URL (set MODAL_BASE_URL to it plus /v1),
  // and the key is a proxy token: its id (wk-…) and secret (ws-…).
  modal: {
    id: "modal",
    baseUrl: "",
    urlEnv: "MODAL_BASE_URL",
    keyEnv: ["MODAL_PROXY_TOKEN_ID", "MODAL_PROXY_TOKEN_SECRET"],
    efforts: ["low", "medium", "high", "xhigh"],
  },
};

export const baseUrlOf = (p: Provider) => (p.urlEnv && process.env[p.urlEnv]) || p.baseUrl;

/** The bearer key, or "" when any part is missing. */
export const keyOf = (p: Provider) => {
  const parts = p.keyEnv.map((name) => process.env[name]);
  return parts.every(Boolean) ? parts.join(".") : "";
};

/** A provider is usable when it has a key and an endpoint to send it to. */
export const isReady = (p: Provider) => Boolean(keyOf(p) && baseUrlOf(p));

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

export const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

/** The lowest effort the provider accepts at or above the one asked for, else its highest. */
export function effortFor(p: Provider, wanted: Effort): Effort | undefined {
  const at = EFFORTS.indexOf(wanted);
  return p.efforts.find((e) => EFFORTS.indexOf(e) >= at) ?? p.efforts.at(-1);
}

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

const spark = (effort: Effort): Rung => ({ provider: "meta", model: MODELS.spark, effort });

/** Which model does each job, in order of preference (PLAN.md §5). */
export const CHAINS: Record<Task, Rung[]> = {
  plan: [spark("medium"), ...open("medium")],
  locate: [...open("none"), spark("none")],
  merge: [spark("low"), ...open("low")],
  recall: [...open("low"), spark("low")],
  answer: [...open("none"), spark("none")],
  grade: [spark("medium"), ...open("medium")],
  // Muse Spark Open takes audio input; Muse Voice Transcribe on Meta, when its key is set, goes first
  // (transcribe.ts), because it is a dedicated speech model at $0.18 an hour.
  transcribe: open("none"),
};
