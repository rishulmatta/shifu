// One entry point for every model call: generate(task, request). It walks the task's provider chain
// (config.ts), asks for JSON matching a zod schema, validates it, retries once with the validation
// error, and moves to the next provider on a refusal, a timeout or a second bad answer.

import { z } from "zod";
import { baseUrlOf, CHAINS, effortFor, isReady, keyOf, PRICES, PROVIDERS, type Rung, type Task } from "./config";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costUsd: number;
}

export interface Generated<T> {
  data: T;
  usage: Usage;
  provider: string;
  model: string;
  ms: number;
}

export interface GenerateRequest<S extends z.ZodType> {
  /** Names the schema for the provider, e.g. "CoursePlan". */
  name: string;
  schema: S;
  system: string;
  user: string;
  /** Sent with the user message, for models that take audio input (base64). */
  audio?: { data: string; format: "wav" };
  timeoutMs?: number;
}

/** Whether any provider in the task's chain has a key and an endpoint. */
export const canRun = (task: Task) => CHAINS[task].some((r) => isReady(PROVIDERS[r.provider]));

export class NoProviderError extends Error {
  constructor(task: Task) {
    super(`No provider has a key for task "${task}"`);
  }
}

export class ChainError extends Error {
  constructor(
    task: Task,
    readonly failures: string[],
  ) {
    super(`Every provider failed for task "${task}": ${failures.join(" | ")}`);
  }
}

/** A provider answered with a status the next rung might not get (rate limit, outage, refusal). */
class RungError extends Error {}

const SAFE_INT = Number.MAX_SAFE_INTEGER;

/** zod → the JSON Schema subset Meta and Baseten accept: no $schema, no safe-integer bounds. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema") continue;
      if ((k === "minimum" || k === "maximum") && Math.abs(v as number) >= SAFE_INT) continue;
      out[k] = strip(v);
    }
    return out;
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}

export function costOf(model: string, inputTokens: number, cachedTokens: number, outputTokens: number) {
  const [input, cached, output] = PRICES[model] ?? [0, 0, 0];
  return ((inputTokens - cachedTokens) * input + cachedTokens * cached + outputTokens * output) / 1e6;
}

type Part = { type: "text"; text: string } | { type: "input_audio"; input_audio: { data: string; format: "wav" } };
type Message = { role: "system" | "user" | "assistant"; content: string | Part[] };

async function call(rung: Rung, messages: Message[], name: string, jsonSchema: object, timeoutMs: number) {
  const provider = PROVIDERS[rung.provider];
  const started = Date.now();
  const res = await fetch(`${baseUrlOf(provider)}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${keyOf(provider)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: rung.model,
      messages,
      response_format: { type: "json_schema", json_schema: { name, schema: jsonSchema, strict: true } },
      ...(rung.effort && { reasoning_effort: effortFor(provider, rung.effort) }),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new RungError(`${rung.provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const u = body.usage ?? {};
  const inputTokens = u.prompt_tokens ?? 0;
  const outputTokens = u.completion_tokens ?? 0;
  const usage: Usage = {
    inputTokens,
    outputTokens,
    // Modal reports reasoning at the top level of usage, the others under completion_tokens_details.
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? u.reasoning_tokens ?? 0,
    costUsd: costOf(rung.model, inputTokens, u.prompt_tokens_details?.cached_tokens ?? 0, outputTokens),
  };
  return { content: String(body.choices?.[0]?.message?.content ?? ""), usage, ms: Date.now() - started };
}

export const addUsage = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  reasoningTokens: a.reasoningTokens + b.reasoningTokens,
  costUsd: a.costUsd + b.costUsd,
});

export const ZERO: Usage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, costUsd: 0 };

function parse<S extends z.ZodType>(schema: S, content: string): { ok: true; data: z.infer<S> } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { ok: false, error: "The reply was not valid JSON." };
  }
  const result = schema.safeParse(json);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: z.prettifyError(result.error) };
}

export async function generate<S extends z.ZodType>(task: Task, req: GenerateRequest<S>): Promise<Generated<z.infer<S>>> {
  const rungs = CHAINS[task].filter((r) => isReady(PROVIDERS[r.provider]));
  if (!rungs.length) throw new NoProviderError(task);

  const jsonSchema = toJsonSchema(req.schema);
  const failures: string[] = [];
  let spent = ZERO;

  for (const rung of rungs) {
    const messages: Message[] = [
      { role: "system", content: req.system },
      {
        role: "user",
        content: req.audio ? [{ type: "text", text: req.user }, { type: "input_audio", input_audio: req.audio }] : req.user,
      },
    ];
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const reply = await call(rung, messages, req.name, jsonSchema, req.timeoutMs ?? 120_000);
        spent = addUsage(spent, reply.usage);
        const parsed = parse(req.schema, reply.content);
        if (parsed.ok) return { data: parsed.data, usage: spent, provider: rung.provider, model: rung.model, ms: reply.ms };
        messages.push(
          { role: "assistant", content: reply.content },
          { role: "user", content: `That reply failed validation:\n${parsed.error}\nReply again with corrected JSON only.` },
        );
        failures.push(`${rung.provider}: invalid output (${parsed.error.split("\n")[0]})`);
      }
    } catch (e) {
      if (!(e instanceof RungError) && !(e instanceof Error && e.name === "TimeoutError")) throw e;
      failures.push(e.message);
    }
  }
  throw new ChainError(task, failures);
}
