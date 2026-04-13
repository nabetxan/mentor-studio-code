import { describe, expect, it } from "vitest";
import {
  parseConfig,
  parseLearnerProfile,
  parseProgressData,
} from "../src/services/dataParser";
import { generateTopicKey } from "../src/services/fileWatcher";

describe("generateTopicKey", () => {
  it("converts label to lowercase hyphenated key with c- prefix", () => {
    expect(generateTopicKey("React Hooks")).toBe("c-react-hooks");
  });

  it("replaces non-alphanumeric characters with hyphens", () => {
    expect(generateTopicKey("Node.js & Express")).toBe("c-node-js-express");
  });

  it("collapses consecutive hyphens", () => {
    expect(generateTopicKey("  A  B  ")).toBe("c-a-b");
  });

  it("returns empty string for non-ASCII-only input", () => {
    expect(generateTopicKey("フック")).toBe("");
  });

  it("handles mixed ASCII and non-ASCII", () => {
    expect(generateTopicKey("React フック")).toBe("c-react");
  });
});

describe("parseProgressData", () => {
  it("parses valid progress JSON", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: "phase1.md",
      current_task: "3",
      current_step: null,
      next_suggest: "task-4",
      resume_context: "Finished task 2",
      completed_tasks: [
        { task: "1", name: "Setup", plan: "phase1.md" },
        { task: "2", name: "Scaffold", plan: "phase1.md" },
      ],
      skipped_tasks: [{ task: "2.5", plan: "phase1.md" }],
      in_progress: [],
      unresolved_gaps: [],
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.current_task).toBe("3");
    expect(result!.current_plan).toBe("phase1.md");
    expect(result!.completed_tasks).toEqual([
      { task: "1", name: "Setup", plan: "phase1.md" },
      { task: "2", name: "Scaffold", plan: "phase1.md" },
    ]);
    expect(result!.skipped_tasks).toEqual([{ task: "2.5", plan: "phase1.md" }]);
  });

  it("filters out invalid skipped_tasks entries", () => {
    const json = JSON.stringify({
      version: "1.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: ["old-string-format", { task: "1", plan: "p.md" }, 42],
      unresolved_gaps: [],
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.skipped_tasks).toEqual([{ task: "1", plan: "p.md" }]);
  });

  it("returns null for invalid JSON", () => {
    expect(parseProgressData("not json")).toBeNull();
  });

  it("returns null for missing required fields", () => {
    expect(parseProgressData(JSON.stringify({ version: "2.0" }))).toBeNull();
  });

  it("parses null current_task as null", () => {
    const json = JSON.stringify({
      version: "1.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      in_progress: [],
      unresolved_gaps: [],
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.current_task).toBeNull();
  });

  it("parses learner_profile.last_updated when present", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
      learner_profile: { last_updated: "2026-03-01" },
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.learner_profile?.last_updated).toBe("2026-03-01");
  });

  it("sets learner_profile to undefined when absent", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.learner_profile).toBeUndefined();
  });

  it("parses full learner_profile fields", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
      learner_profile: {
        experience: "3 years frontend",
        level: "intermediate",
        interests: ["backend", "AI"],
        weak_areas: ["backend"],
        mentor_style: "gentle",
        last_updated: "2026-03-28T00:00:00Z",
      },
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.learner_profile).toEqual({
      experience: "3 years frontend",
      level: "intermediate",
      interests: ["backend", "AI"],
      weak_areas: ["backend"],
      mentor_style: "gentle",
      last_updated: "2026-03-28T00:00:00Z",
    });
  });

  it("defaults missing learner_profile fields to empty values", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
      learner_profile: { last_updated: "2026-03-01" },
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.learner_profile).toEqual({
      experience: "",
      level: "",
      interests: [],
      weak_areas: [],
      mentor_style: "",
      last_updated: "2026-03-01",
    });
  });

  it("sets learner_profile to undefined when last_updated is not a string or null", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
      learner_profile: { last_updated: 42 },
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.learner_profile).toBeUndefined();
  });
});

describe("parseLearnerProfile", () => {
  it("returns valid LearnerProfile from complete object", () => {
    const input = {
      experience: "3 years",
      level: "intermediate",
      interests: ["AI"],
      weak_areas: ["backend"],
      mentor_style: "gentle",
      last_updated: "2026-03-28T00:00:00Z",
    };
    expect(parseLearnerProfile(input)).toEqual(input);
  });

  it("returns null for non-object input", () => {
    expect(parseLearnerProfile(null)).toBeNull();
    expect(parseLearnerProfile("string")).toBeNull();
    expect(parseLearnerProfile(42)).toBeNull();
    expect(parseLearnerProfile(undefined)).toBeNull();
  });

  it("returns null when last_updated is missing", () => {
    expect(
      parseLearnerProfile({
        experience: "3 years",
        level: "intermediate",
        interests: [],
        weak_areas: [],
        mentor_style: "gentle",
      }),
    ).toBeNull();
  });

  it("defaults missing string fields to empty and missing arrays to []", () => {
    const result = parseLearnerProfile({
      last_updated: "2026-04-01T00:00:00Z",
    });
    expect(result).toEqual({
      experience: "",
      level: "",
      interests: [],
      weak_areas: [],
      mentor_style: "",
      last_updated: "2026-04-01T00:00:00Z",
    });
  });

  it("returns valid profile when last_updated is null", () => {
    const result = parseLearnerProfile({ last_updated: null });
    expect(result).not.toBeNull();
    expect(result!.last_updated).toBeNull();
  });
});

describe("parseConfig with new fields", () => {
  it("parses workspacePath when present", () => {
    const raw = JSON.stringify({
      repositoryName: "test",
      topics: [],
      workspacePath: "/Users/test/workspace/my-project",
    });
    const result = parseConfig(raw);
    expect(result?.workspacePath).toBe("/Users/test/workspace/my-project");
  });

  it("parses without workspacePath (backwards compatible)", () => {
    const raw = JSON.stringify({
      repositoryName: "test",
      topics: [],
    });
    const result = parseConfig(raw);
    expect(result).not.toBeNull();
    expect(result?.workspacePath).toBeUndefined();
  });

  it("parses extensionUninstalled when present", () => {
    const raw = JSON.stringify({
      repositoryName: "test",
      topics: [],
      extensionUninstalled: true,
    });
    const result = parseConfig(raw);
    expect(result?.extensionUninstalled).toBe(true);
  });
});
