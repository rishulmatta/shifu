import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ChainError, generate, NoProviderError, toJsonSchema } from "./router";

const schema = z.object({ answer: z.string() });
const req = { name: "Answer", schema, system: "s", user: "u" };

const reply = (content: string, status = 200) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, completion_tokens_details: { reasoning_tokens: 40 } },
    }),
    { status },
  );

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_MODEL_API_KEY", "meta-key");
  vi.stubEnv("BASETEN_API_KEY", "baseten-key");
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const urlOf = (i: number) => String(fetchMock.mock.calls[i][0]);
const bodyOf = (i: number) => JSON.parse(String(fetchMock.mock.calls[i][1]?.body));

describe("generate", () => {
  it("returns validated data from the first provider in the chain, with usage and cost", async () => {
    fetchMock.mockResolvedValueOnce(reply('{"answer":"42"}'));
    const out = await generate("plan", req);
    expect(out.data).toEqual({ answer: "42" });
    expect(out.provider).toBe("meta");
    expect(urlOf(0)).toContain("api.meta.ai");
    expect(out.usage).toMatchObject({ inputTokens: 100, outputTokens: 50, reasoningTokens: 40 });
    expect(out.usage.costUsd).toBeCloseTo((100 * 1.25 + 50 * 4.25) / 1e6);
  });

  it("skips a provider without a key", async () => {
    vi.stubEnv("META_MODEL_API_KEY", "");
    fetchMock.mockResolvedValueOnce(reply('{"answer":"42"}'));
    const out = await generate("plan", req);
    expect(out.provider).toBe("baseten");
    expect(bodyOf(0).reasoning_effort).toBe("medium");
  });

  it("falls through to the next provider on a rate limit", async () => {
    fetchMock.mockResolvedValueOnce(reply("rate limited", 429)).mockResolvedValueOnce(reply('{"answer":"42"}'));
    const out = await generate("plan", req);
    expect(out.provider).toBe("baseten");
  });

  it("retries once with the validation error, counting both calls' usage", async () => {
    fetchMock.mockResolvedValueOnce(reply('{"wrong":1}')).mockResolvedValueOnce(reply('{"answer":"42"}'));
    const out = await generate("plan", req);
    expect(out.data.answer).toBe("42");
    expect(bodyOf(1).messages.at(-1).content).toContain("failed validation");
    expect(out.usage.inputTokens).toBe(200);
  });

  it("throws a ChainError listing every failure when all providers fail", async () => {
    fetchMock.mockImplementation(async () => reply("down", 503));
    await expect(generate("plan", req)).rejects.toBeInstanceOf(ChainError);
  });

  it("throws NoProviderError when no key is set", async () => {
    vi.stubEnv("META_MODEL_API_KEY", "");
    vi.stubEnv("BASETEN_API_KEY", "");
    await expect(generate("plan", req)).rejects.toBeInstanceOf(NoProviderError);
  });

  it("sends reasoning effort only to providers known to accept it", async () => {
    fetchMock.mockResolvedValueOnce(reply('{"answer":"42"}'));
    await generate("plan", req);
    expect(bodyOf(0).reasoning_effort).toBeUndefined();
  });
});

describe("toJsonSchema", () => {
  it("drops $schema and safe-integer bounds but keeps real limits", () => {
    const out = toJsonSchema(z.object({ n: z.number().int().min(1).max(5) }));
    expect(out.$schema).toBeUndefined();
    expect(out).toMatchObject({ properties: { n: { type: "integer", minimum: 1, maximum: 5 } }, additionalProperties: false });
  });
});
