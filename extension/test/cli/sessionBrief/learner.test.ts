import { describe, expect, it } from "vitest";

import { mapLearner } from "../../../src/cli/commands/sessionBrief/learner";

describe("mapLearner", () => {
  it("maps snake_case to camelCase", () => {
    const out = mapLearner(
      {
        experience: "exp",
        level: "beginner",
        interests: ["a"],
        weak_areas: ["w"],
        mentor_style: "socratic",
        last_updated: "2026-04-12T00:00:00Z",
      },
      "review",
    );
    expect(out).toEqual({
      experience: "exp",
      level: "beginner",
      interests: ["a"],
      weakAreas: ["w"],
      mentorStyle: "socratic",
    });
  });

  it("includes lastUpdated ONLY for mentor-session flow", () => {
    const p = { last_updated: "2026-04-12T00:00:00Z" };
    expect(mapLearner(p, "mentor-session").lastUpdated).toBe(
      "2026-04-12T00:00:00Z",
    );
    for (const flow of [
      "review",
      "comprehension-check",
      "implementation-review",
    ] as const) {
      expect(mapLearner(p, flow)).not.toHaveProperty("lastUpdated");
    }
  });

  it("defaults on empty profile", () => {
    expect(mapLearner({}, "review")).toEqual({
      experience: "",
      level: "",
      interests: [],
      weakAreas: [],
      mentorStyle: "",
    });
  });
});
