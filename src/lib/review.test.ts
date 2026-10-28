import { describe, expect, it } from "vitest";
import { due, estimateMinutes, newCard, rate, type ReviewCard } from "./review";

const NOW = new Date("2026-10-28T09:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const card = (id: string, kind: ReviewCard["kind"] = "card") => newCard(id, kind, "bayes-rule/1", NOW);
const dueMs = (c: ReviewCard) => new Date(c.fsrs.due).getTime();

describe("newCard", () => {
  it("is due at once and keeps its identity", () => {
    const c = card("item-1", "check");
    expect(c).toMatchObject({ id: "item-1", kind: "check", objectiveId: "bayes-rule/1" });
    expect(c.fsrs.due).toBe(NOW.toISOString());
    expect(c.fsrs.reps).toBe(0);
  });

  it("stores plain JSON: a localStorage round trip changes nothing", () => {
    const rated = rate(card("item-1"), "good", NOW);
    expect(JSON.parse(JSON.stringify(rated))).toEqual(rated);
    expect(typeof rated.fsrs.due).toBe("string");
    expect(typeof rated.fsrs.last_review).toBe("string");
  });
});

describe("rate", () => {
  it("schedules a new card rated good later than one rated hard", () => {
    expect(dueMs(rate(card("a"), "good", NOW))).toBeGreaterThan(dueMs(rate(card("b"), "hard", NOW)));
    expect(dueMs(rate(card("a"), "easy", NOW))).toBeGreaterThan(dueMs(rate(card("b"), "good", NOW)));
  });

  it("makes a card rated again due within the day, sooner than any other rating", () => {
    const again = rate(card("a"), "again", NOW);
    expect(dueMs(again)).toBeGreaterThan(NOW.getTime());
    expect(dueMs(again) - NOW.getTime()).toBeLessThan(DAY_MS);
    for (const rating of ["hard", "good", "easy"] as const) {
      expect(dueMs(again)).toBeLessThan(dueMs(rate(card("b"), rating, NOW)));
    }
  });

  it("does not mutate the rated card and preserves its identity", () => {
    const before = card("item-1", "check");
    const snapshot = JSON.parse(JSON.stringify(before));
    const after = rate(before, "good", NOW);
    expect(before).toEqual(snapshot);
    expect(after).toMatchObject({ id: "item-1", kind: "check", objectiveId: "bayes-rule/1" });
    expect(after.fsrs.reps).toBe(1);
    expect(after.fsrs.last_review).toBe(NOW.toISOString());
  });

  it("pushes the due date further out on a later good review", () => {
    const first = rate(card("a"), "good", NOW);
    const second = rate(first, "good", new Date(first.fsrs.due));
    expect(dueMs(second)).toBeGreaterThan(dueMs(first));
    expect(second.fsrs.reps).toBe(2);
  });
});

describe("due", () => {
  it("excludes future cards and sorts oldest due first", () => {
    const past = (id: string, hoursAgo: number): ReviewCard => ({
      ...card(id),
      fsrs: { ...card(id).fsrs, due: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString() },
    });
    const future = rate(card("future"), "easy", NOW);
    const result = due([past("recent", 1), future, past("oldest", 48), card("now")], NOW);
    expect(result.map((c) => c.id)).toEqual(["oldest", "recent", "now"]);
  });

  it("includes a card due exactly now and returns none when nothing is due", () => {
    expect(due([card("now")], NOW).map((c) => c.id)).toEqual(["now"]);
    expect(due([rate(card("future"), "easy", NOW)], NOW)).toEqual([]);
    expect(due([], NOW)).toEqual([]);
  });

  it("does not reorder the input", () => {
    const cards = [rate(card("b"), "easy", NOW), card("a")];
    due(cards, NOW);
    expect(cards.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("estimateMinutes", () => {
  it("is 0 for no cards and rounds partial minutes up", () => {
    expect(estimateMinutes([])).toBe(0);
    expect(estimateMinutes([card("a")])).toBe(1); // 15 s
    expect(estimateMinutes([card("a"), card("b"), card("c"), card("d")])).toBe(1); // 60 s
    expect(estimateMinutes([card("a"), card("b"), card("c"), card("d"), card("e")])).toBe(2); // 75 s
  });

  it("counts checks at twice a card", () => {
    expect(estimateMinutes([card("a", "check")])).toBe(1); // 30 s
    expect(estimateMinutes([card("a", "check"), card("b", "check")])).toBe(1); // 60 s
    expect(estimateMinutes([card("a", "check"), card("b", "check"), card("c")])).toBe(2); // 75 s
  });
});
