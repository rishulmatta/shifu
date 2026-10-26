import { describe, expect, it } from "vitest";
import { clockToSeconds, isoToSeconds, parseCaptions, parseSearchApi } from "./youtube";

describe("clockToSeconds / isoToSeconds", () => {
  it("reads YouTube's clock and ISO durations", () => {
    expect(clockToSeconds("20:08")).toBe(1208);
    expect(clockToSeconds("3:22:45")).toBe(12165);
    expect(Number.isNaN(clockToSeconds("LIVE"))).toBe(true);
    expect(isoToSeconds("PT1H2M3S")).toBe(3723);
    expect(isoToSeconds("PT45S")).toBe(45);
  });
});

describe("parseSearchApi", () => {
  it("keeps finished videos with a length and skips live streams", () => {
    const hits = parseSearchApi({
      videos: [
        { id: "a", title: "Bayes", length: "12:30", extracted_views: 900, channel: { title: "Ann" } },
        { id: "b", title: "Live now", live: true, length: "1:00:00" },
        { id: "c", title: "No length" },
      ],
    });
    expect(hits).toEqual([{ id: "a", title: "Bayes", channel: "Ann", durationS: 750, views: 900 }]);
  });
});

describe("parseCaptions", () => {
  const transcripts = [
    { text: " the prior  is ", start: 1.5, duration: 2 },
    { text: "", start: 3.5, duration: 1 },
  ];

  it("returns cleaned lines in the language asked for", () => {
    const lines = parseCaptions({ transcripts, available_languages: [{ name: "English (auto-generated)", lang: "en" }] }, "en");
    expect(lines).toEqual([{ start: 1.5, duration: 2, text: "the prior is" }]);
  });

  it("refuses a track that only exists as a machine translation", () => {
    expect(parseCaptions({ transcripts, available_languages: [{ name: "Spanish", lang: "es" }] }, "en")).toBeNull();
  });

  it("returns null on an error or an empty track", () => {
    expect(parseCaptions({ error: "Selected language hasn't been transcribed." }, "en")).toBeNull();
    expect(parseCaptions({ transcripts: [] }, "en")).toBeNull();
  });
});
