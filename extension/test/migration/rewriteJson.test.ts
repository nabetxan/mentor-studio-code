import { describe, expect, it } from "vitest";
import {
  rewriteConfig,
  rewriteProgress,
} from "../../src/migration/rewriteJson";

describe("rewriteProgress", () => {
  it("retains only resume_context and learner_profile, discards legacy fields", () => {
    const out = rewriteProgress({
      progress: {
        version: "1.0",
        current_plan: null,
        current_task: "legacy-7",
        current_step: "step",
        next_suggest: "x",
        completed_tasks: [{}],
        skipped_tasks: [],
        unresolved_gaps: [{}],
        resume_context: "ctx",
        learner_profile: { name: "k" },
      },
    });
    expect(out).toEqual({
      resume_context: "ctx",
      learner_profile: { name: "k" },
    });
  });

  it("sets resume_context to null when absent", () => {
    const out = rewriteProgress({
      progress: { current_task: "unknown" },
    });
    expect(out.resume_context).toBeNull();
  });

  it("discards current_task even when present as number", () => {
    const out = rewriteProgress({
      progress: { current_task: 42, resume_context: "r" },
    });
    expect(out).not.toHaveProperty("current_task");
    expect(out.resume_context).toBe("r");
  });

  it("discards current_step even when present", () => {
    const out = rewriteProgress({
      progress: { current_step: "step-1", resume_context: null },
    });
    expect(out).not.toHaveProperty("current_step");
  });

  it("defaults learner_profile to empty object when absent", () => {
    const out = rewriteProgress({
      progress: {},
    });
    expect(out.learner_profile).toEqual({});
  });
});

describe("rewriteConfig", () => {
  it("drops topics and mentorFiles.plan, preserves other fields", () => {
    const out = rewriteConfig({
      repositoryName: "x",
      topics: [{ key: "a", label: "A" }],
      mentorFiles: { spec: "spec.md", plan: "plan.md" },
      locale: "ja",
      enableMentor: true,
    });
    expect(out).toEqual({
      repositoryName: "x",
      mentorFiles: { spec: "spec.md" },
      locale: "ja",
      enableMentor: true,
    });
  });

  it("handles missing mentorFiles gracefully", () => {
    const out = rewriteConfig({ topics: [], locale: "en" });
    expect(out).toEqual({ locale: "en" });
  });
});
