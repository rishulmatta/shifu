import { describe, expect, it } from "vitest";
import { CourseView } from "./course-view";
import { bayesCourse } from "./fixtures/bayes";
import { mergeCourse, NO_OVERLAY } from "./overlay";
import { groupPath } from "./path";

describe("groupPath", () => {
  const merged = mergeCourse(bayesCourse, NO_OVERLAY);
  const view = new CourseView(bayesCourse);

  it("groups each concept with its blocks and keeps quizzes, teach-backs and challenges on their own", () => {
    const groups = groupPath(merged, view, []);
    expect(groups[0]).toMatchObject({ id: "challenge-before", items: [{ index: 0 }] });
    expect(groups[1].concept?.id).toBe("priors-and-evidence");
    expect(groups[1].items.map((i) => i.block.kind)).toEqual(["intro", "clip", "check", "clip", "check", "cards"]);
    expect(groups.map((g) => g.id)).toContain("teachback-0");
    expect(groups.map((g) => g.id)).toContain("quiz-0");
    expect(groups.at(-1)?.id).toBe("challenge-after");
    expect(groups.flatMap((g) => g.items).length).toBe(bayesCourse.timeline.length);
  });

  it("places a concept the coach is building before the concept that needs it", () => {
    const concept = { ...bayesCourse.plan.concepts[0], id: "conditional-x1", title: "Conditional probability" };
    const groups = groupPath(merged, view, [{ concept, before: "bayes-rule" }]);
    const at = groups.findIndex((g) => g.id === "conditional-x1");
    expect(groups[at].pending).toBe(true);
    expect(groups[at + 1].id).toBe("bayes-rule");
  });
});
