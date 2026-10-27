import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canTranscribe, transcribeWav, trimEcho } from "./transcribe";

const fetchMock = vi.fn<typeof fetch>();
const wav = new Blob([new Uint8Array([82, 73, 70, 70])], { type: "audio/wav" });

const sparkReply = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text }) } }], usage: {} }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_MODEL_API_KEY", "");
  vi.stubEnv("BASETEN_API_KEY", "");
  vi.stubEnv("MODAL_PROXY_TOKEN", "");
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("transcribeWav", () => {
  it("is off with no Meta, Baseten or Modal key", () => {
    expect(canTranscribe()).toBe(false);
  });

  it("uses Muse Voice Transcribe when the Meta key is set", async () => {
    vi.stubEnv("META_MODEL_API_KEY", "meta-key");
    fetchMock.mockResolvedValueOnce(new Response("unknown: the prior  is a belief\n"));
    expect(await transcribeWav(wav)).toBe("the prior is a belief");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/asr/transcribe");
  });

  it("has Muse Spark Open listen when there is no Meta key", async () => {
    vi.stubEnv("BASETEN_API_KEY", "baseten-key");
    fetchMock.mockResolvedValueOnce(sparkReply(" the prior\n is a belief "));
    expect(await transcribeWav(wav)).toBe("the prior is a belief");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages[1].content[1]).toEqual({ type: "input_audio", input_audio: { data: "UklGRg==", format: "wav" } });
  });

  it("falls back to Muse Spark Open when Muse Voice Transcribe fails", async () => {
    vi.stubEnv("META_MODEL_API_KEY", "meta-key");
    vi.stubEnv("BASETEN_API_KEY", "baseten-key");
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 503 })).mockResolvedValueOnce(sparkReply("the prior"));
    expect(await transcribeWav(wav)).toBe("the prior");
  });
});

describe("trimEcho", () => {
  const said = "If you test positive there's a 99% chance you have it. The base rate doesn't really matter once you have the test.";

  it("trims the last sentence echoed whole, cut short, or with a word added", () => {
    expect(trimEcho(`${said} The base rate doesn't really matter once you have the test.`)).toBe(said);
    expect(trimEcho(`${said} The base rate doesn't`)).toBe(said);
    expect(trimEcho(`${said} The base rate doesn't really matter once you have the test result.`)).toBe(said);
    expect(trimEcho(`${said.slice(0, -1)}, the base rate doesn't really matter once you have the test result?`)).toBe(said);
  });

  it("keeps what was really said", () => {
    expect(trimEcho(said)).toBe(said);
    expect(trimEcho("The prior is P of A. The posterior is P of A given B.")).toBe("The prior is P of A. The posterior is P of A given B.");
    expect(trimEcho("Multiply by the likelihood. Then divide by the evidence, the evidence overall.")).toBe(
      "Multiply by the likelihood. Then divide by the evidence, the evidence overall.",
    );
    expect(trimEcho("A over B. A over B over C.")).toBe("A over B. A over B over C.");
    const tb = "People confuse the chance of a positive test given the disease with the chance of the disease given a positive test.";
    expect(trimEcho(tb)).toBe(tb);
  });
});
