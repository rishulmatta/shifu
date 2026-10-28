import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bayesCourse } from "../fixtures/bayes";
import { gradeAnswer, gradeTeachback } from "./grade";

const fetchMock = vi.fn<typeof fetch>();
const reply = (data: object) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }], usage: {} }));
const objectives = bayesCourse.plan.concepts.find((c) => c.id === "bayes-rule")!.objectives;
const explanation = "You multiply the prior by the likelihood and then divide by how likely the evidence is overall.";

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_MODEL_API_KEY", "meta-key");
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("gradeTeachback", () => {
  it("maps verdicts and the student's question to objectives, and needs the learner's words for covered", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({
        results: [
          { objective: "O1", verdict: "covered", note: "you got it", heard: "multiply the prior by the likelihood" },
          { objective: "O2", verdict: "covered", note: "you said so", heard: "words they never said" },
        ],
        encouragement: "nice start",
        followUp: { objective: "O2", question: " But why is it a share of an area? " },
      }),
    );
    const g = await gradeTeachback({ objectives, clipTexts: [], explanation, misconceptions: ["flips the condition"] });
    expect(g.results.map((r) => r.verdict)).toEqual(["covered", "missing"]);
    expect(g.results[0].note).toBe("You got it");
    expect(g.followUp).toEqual({ objectiveId: objectives[1].id, question: "But why is it a share of an area?" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).messages[1].content).toContain("- flips the condition");
  });

  it("drops a question aimed at an objective that isn't there", async () => {
    fetchMock.mockResolvedValueOnce(reply({ results: [], encouragement: "", followUp: { objective: "O9", question: "Why?" } }));
    const g = await gradeTeachback({ objectives, clipTexts: [], explanation });
    expect(g.followUp).toBeUndefined();
    expect(g.results.every((r) => r.verdict === "missing")).toBe(true);
  });
});

describe("gradeAnswer", () => {
  it("grades the answer on its one objective, needing the learner's words for covered", async () => {
    fetchMock.mockResolvedValueOnce(reply({ objective: "O1", verdict: "covered", note: "right", heard: "divide by how likely the evidence is" }));
    const r = await gradeAnswer({ objective: objectives[0], question: "Why divide?", answer: explanation, clipText: "" });
    expect(r).toMatchObject({ objectiveId: objectives[0].id, verdict: "covered", note: "Right" });
  });
});
