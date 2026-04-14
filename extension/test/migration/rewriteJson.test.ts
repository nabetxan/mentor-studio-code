import { describe, expect, it } from "vitest";
import {
  rewriteConfig,
  rewriteProgress,
} from "../../src/migration/rewriteJson";

describe("rewriteProgress", () => {
  it("retains only current_task (int), current_step, resume_context, learner_profile", () => {
    const taskMap = new Map([["legacy-7", 42]]);
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
      taskMap,
    });
    expect(out).toEqual({
      current_task: 42,
      current_step: "step",
      resume_context: "ctx",
      learner_profile: { name: "k" },
    });
  });

  it("maps unknown current_task to null", () => {
    const out = rewriteProgress({
      progress: { current_task: "unknown" },
      taskMap: new Map(),
    });
    expect(out.current_task).toBeNull();
  });

  it("preserves numeric current_task (post-migration value) as-is", () => {
    const out = rewriteProgress({
      progress: { current_task: 42 },
      taskMap: new Map([["legacy-7", 99]]),
    });
    expect(out.current_task).toBe(42);
  });

  it("null current_task stays null", () => {
    const out = rewriteProgress({
      progress: { current_task: null },
      taskMap: new Map(),
    });
    expect(out.current_task).toBeNull();
  });

  it("defaults learner_profile to empty object when absent", () => {
    const out = rewriteProgress({
      progress: {},
      taskMap: new Map(),
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
