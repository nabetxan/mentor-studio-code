import { describe, expect, it } from "vitest";

import {
  mapLearner,
  type DbProfileInput,
} from "../../../src/cli/commands/sessionBrief/learner";

const FULL: DbProfileInput = {
  experience: "exp",
  level: "beginner",
  interests: ["a"],
  weakAreas: ["w"],
  mentorStyle: "socratic",
  lastUpdated: "2026-04-12T00:00:00Z",
};

const EMPTY: DbProfileInput = {
  experience: "",
  level: "",
  interests: [],
  weakAreas: [],
  mentorStyle: "",
  lastUpdated: null,
};

describe("mapLearner", () => {
  it("maps DbProfileInput (camelCase) through identically", () => {
    const out = mapLearner(FULL, "review");
    expect(out).toEqual({
      experience: "exp",
      level: "beginner",
      interests: ["a"],
      weakAreas: ["w"],
      mentorStyle: "socratic",
    });
  });

  it("includes lastUpdated ONLY for mentor-session flow", () => {
    expect(mapLearner(FULL, "mentor-session").lastUpdated).toBe(
      "2026-04-12T00:00:00Z",
    );
    for (const flow of [
      "review",
      "comprehension-check",
      "implementation-review",
    ] as const) {
      expect(mapLearner(FULL, flow)).not.toHaveProperty("lastUpdated");
    }
  });

  it("defaults on empty profile", () => {
    expect(mapLearner(EMPTY, "review")).toEqual({
      experience: "",
      level: "",
      interests: [],
      weakAreas: [],
      mentorStyle: "",
    });
  });

  it("propagates null lastUpdated for mentor-session", () => {
    expect(mapLearner(EMPTY, "mentor-session").lastUpdated).toBeNull();
  });
});
