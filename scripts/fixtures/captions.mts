// Two transcripts written for testing (original text, in the style of YouTube auto-captions), so the
// span-finding and recall steps can run before the transcript API key arrives.

import type { CaptionLine, Video } from "../../src/lib/types";

const toLines = (timed: [number, string][], end: number): CaptionLine[] =>
  timed.map(([start, text], i) => ({ start, duration: (timed[i + 1]?.[0] ?? end) - start, text }));

export const lecture: { video: Video; lines: CaptionLine[] } = {
  video: { id: "test-lecture", title: "Bayes theorem in 3 minutes", channel: "Test Lecture Channel", durationS: 145 },
  lines: toLines(
    [
      [0, "hey everyone welcome back to the channel"],
      [4, "today we're finally doing bayes theorem"],
      [8, "which sounds scary but it's really just a way"],
      [12, "of updating what you believe when you get new evidence"],
      [17, "before that though a quick word from today's sponsor"],
      [21, "brightlearn has thousands of interactive courses"],
      [26, "use the link in the description for twenty percent off"],
      [31, "okay back to bayes"],
      [34, "let's start with the prior"],
      [37, "your prior is how likely you thought something was"],
      [41, "before you saw any evidence at all"],
      [45, "say one in a hundred people in a town have a rare allergy"],
      [50, "so before testing anyone the prior is one percent"],
      [55, "now the evidence we get is a skin test"],
      [59, "and the test comes back positive"],
      [63, "the question bayes asks is how likely was that positive result"],
      [68, "if the person really has the allergy"],
      [72, "that's called the likelihood"],
      [75, "for this test it's ninety percent"],
      [79, "so here's the whole rule in one line"],
      [83, "you take the prior and multiply it by the likelihood"],
      [88, "one percent times ninety percent"],
      [92, "and then you divide by how likely a positive result is overall"],
      [97, "counting everyone who tests positive allergic or not"],
      [102, "if eight percent of people test positive in total"],
      [107, "you get point nine percent divided by eight percent"],
      [112, "which is about eleven percent"],
      [116, "and that's your posterior"],
      [119, "the updated belief after seeing the evidence"],
      [123, "notice how it's way lower than the ninety percent you might expect"],
      [128, "that's because the allergy is rare to begin with"],
      [132, "so most positive results come from people who don't have it"],
      [137, "alright if this helped hit subscribe"],
      [141, "and i'll see you in the next one"],
    ],
    145,
  ),
};

export const areaPicture: { video: Video; lines: CaptionLine[] } = {
  video: { id: "test-area", title: "The picture that makes Bayes obvious", channel: "Test Visual Channel", durationS: 69 },
  lines: toLines(
    [
      [0, "here's a picture that makes bayes rule obvious"],
      [5, "draw a square and let its area stand for every possibility"],
      [10, "shade a thin strip on the left for the people who have the allergy"],
      [15, "that strip is the prior one percent of the square"],
      [20, "now the evidence is a positive test"],
      [24, "so we only keep the parts of the square where the test is positive"],
      [29, "most of the thin strip stays because the test catches ninety percent"],
      [34, "but a chunk of the big unshaded part stays too"],
      [38, "those are the false positives"],
      [41, "once you've seen a positive result"],
      [45, "the posterior is just the shaded share of what's left"],
      [49, "and because the false positives cover more area"],
      [53, "the shaded share ends up small"],
      [57, "that's all bayes rule is"],
      [60, "restricting the space to what the evidence allows"],
      [64, "and asking what fraction of it your hypothesis takes up"],
    ],
    69,
  ),
};
