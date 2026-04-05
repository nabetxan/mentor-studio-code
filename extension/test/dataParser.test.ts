import type { TopicConfig } from "@mentor-studio/shared";
import { describe, expect, it } from "vitest";
import {
  computeDashboardData,
  parseConfig,
  parseLearnerProfile,
  parseProgressData,
  parseQuestionHistory,
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

describe("parseQuestionHistory", () => {
  it("parses valid question history with id and reviewOf", () => {
    const json = JSON.stringify({
      history: [
        {
          id: "q_abc00001",
          reviewOf: null,
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "interface vs type",
          question: "What is the difference?",
          userAnswer: "interface can extend",
          isCorrect: false,
        },
      ],
    });
    const result = parseQuestionHistory(json);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].id).toBe("q_abc00001");
    expect(result.history[0].reviewOf).toBeNull();
    expect(result.history[0].isCorrect).toBe(false);
  });

  it("returns empty history for invalid JSON", () => {
    expect(parseQuestionHistory("broken").history).toEqual([]);
  });

  it("auto-generates id for entries missing id field", () => {
    const json = JSON.stringify({
      history: [
        {
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "interface vs type",
          question: "What is the difference?",
          userAnswer: "interface can extend",
          isCorrect: false,
        },
      ],
    });
    const result = parseQuestionHistory(json);
    expect(result.history).toHaveLength(1);
    expect(typeof result.history[0].id).toBe("string");
    expect(result.history[0].id.length).toBeGreaterThan(0);
    expect(result.history[0].reviewOf).toBeNull();
  });

  it("preserves reviewOf when present as string", () => {
    const json = JSON.stringify({
      history: [
        {
          id: "q_abc00001",
          reviewOf: "q_abc00000",
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "test",
          question: "test?",
          userAnswer: "yes",
          isCorrect: true,
        },
      ],
    });
    const result = parseQuestionHistory(json);
    expect(result.history[0].reviewOf).toBe("q_abc00000");
  });
});

describe("computeDashboardData", () => {
  const topics: TopicConfig[] = [
    { key: "typescript", label: "TypeScript" },
    { key: "react", label: "React" },
    { key: "concurrency", label: "Concurrency" },
  ];

  const baseProgress = {
    version: "2.0",
    current_plan: "phase1.md",
    current_task: "2",
    current_step: null,
    next_suggest: "",
    resume_context: "",
    completed_tasks: [{ task: "1", name: "Setup", plan: "phase1.md" }],
    skipped_tasks: [],
    unresolved_gaps: [],
  };

  it("uses latest answer per group for correctRate", () => {
    const history = {
      history: [
        {
          id: "q_abc00001",
          reviewOf: null,
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "interface vs type",
          question: "Difference?",
          userAnswer: "extends",
          isCorrect: false,
        },
        {
          id: "q_abc00002",
          reviewOf: null,
          answeredAt: "2026-03-01T11:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "generics",
          question: "What are generics?",
          userAnswer: "Type parameters",
          isCorrect: true,
        },
        {
          id: "q_abc00003",
          reviewOf: "q_abc00001",
          answeredAt: "2026-03-02T10:00:00Z",
          taskId: "task-2",
          topic: "typescript",
          concept: "interface vs type",
          question: "Difference revisited?",
          userAnswer: "interface extends, type uses &",
          isCorrect: true,
        },
      ],
    };

    const result = computeDashboardData(baseProgress, history, topics);
    expect(result.totalQuestions).toBe(3);
    expect(result.correctRate).toBe(1.0);
  });

  it("counts groups per topic, not entries", () => {
    const history = {
      history: [
        {
          id: "q_abc00001",
          reviewOf: null,
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "interface vs type",
          question: "Difference?",
          userAnswer: "wrong",
          isCorrect: false,
        },
        {
          id: "q_abc00002",
          reviewOf: "q_abc00001",
          answeredAt: "2026-03-02T10:00:00Z",
          taskId: "task-2",
          topic: "typescript",
          concept: "interface vs type",
          question: "Difference revisited?",
          userAnswer: "correct",
          isCorrect: true,
        },
        {
          id: "q_abc00003",
          reviewOf: null,
          answeredAt: "2026-03-01T12:00:00Z",
          taskId: "task-1",
          topic: "react",
          concept: "useState",
          question: "What does useState return?",
          userAnswer: "[value, setter]",
          isCorrect: true,
        },
      ],
    };

    const result = computeDashboardData(baseProgress, history, topics);
    // Topics with 100% rate are filtered out from byTopic
    const ts = result.byTopic.find((t) => t.topic === "typescript");
    expect(ts).toBeUndefined();

    const react = result.byTopic.find((t) => t.topic === "react");
    expect(react).toBeUndefined();
  });

  it("treats orphaned reviewOf as its own root", () => {
    const history = {
      history: [
        {
          id: "q_abc00001",
          reviewOf: "q_nonexistent",
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "closures",
          question: "What are closures?",
          userAnswer: "functions with scope",
          isCorrect: true,
        },
      ],
    };

    const result = computeDashboardData(baseProgress, history, topics);
    expect(result.totalQuestions).toBe(1);
    expect(result.correctRate).toBe(1.0);
  });

  it("handles empty history", () => {
    const result = computeDashboardData(baseProgress, { history: [] }, topics);
    expect(result.totalQuestions).toBe(0);
    expect(result.correctRate).toBe(0);
    expect(result.byTopic).toEqual([]);
  });

  it("includes profileLastUpdated from learner_profile.last_updated", () => {
    const progress = {
      ...baseProgress,
      current_plan: null,
      current_task: null,
      completed_tasks: [],
      learner_profile: {
        experience: "",
        level: "",
        interests: [],
        weak_areas: [],
        mentor_style: "",
        last_updated: "2026-03-01",
      },
    };
    const result = computeDashboardData(progress, { history: [] }, []);
    expect(result.profileLastUpdated).toBe("2026-03-01");
  });

  it("returns null for profileLastUpdated when learner_profile is absent", () => {
    const progress = {
      ...baseProgress,
      current_plan: null,
      current_task: null,
      completed_tasks: [],
    };
    const result = computeDashboardData(progress, { history: [] }, []);
    expect(result.profileLastUpdated).toBeNull();
  });

  it("propagates unresolvedGaps and currentTask from progress", () => {
    const progress = {
      ...baseProgress,
      unresolved_gaps: [
        {
          questionId: "q_abc00001",
          concept: "interface vs type",
          topic: "typescript",
          last_missed: "2026-03-01",
          task: "task-1",
          note: "confused extends vs &",
        },
      ],
    };
    const history = {
      history: [
        {
          id: "q_abc00001",
          reviewOf: null,
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "interface vs type",
          question: "Difference?",
          userAnswer: "extends",
          isCorrect: false,
        },
      ],
    };
    const result = computeDashboardData(progress, history, topics);
    expect(result.unresolvedGaps).toHaveLength(1);
    expect(result.currentTask).toBe("2");
  });

  it("handles 3-entry chain where all reviewOf point to root", () => {
    const history = {
      history: [
        {
          id: "q_abc00001",
          reviewOf: null,
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "generics",
          question: "What are generics?",
          userAnswer: "wrong",
          isCorrect: false,
        },
        {
          id: "q_abc00002",
          reviewOf: "q_abc00001",
          answeredAt: "2026-03-05T10:00:00Z",
          taskId: "task-2",
          topic: "typescript",
          concept: "generics",
          question: "Generics revisited",
          userAnswer: "still wrong",
          isCorrect: false,
        },
        {
          id: "q_abc00003",
          reviewOf: "q_abc00001",
          answeredAt: "2026-03-10T10:00:00Z",
          taskId: "task-3",
          topic: "typescript",
          concept: "generics",
          question: "Generics again",
          userAnswer: "Type parameters",
          isCorrect: true,
        },
      ],
    };

    const result = computeDashboardData(baseProgress, history, topics);
    expect(result.totalQuestions).toBe(3);
    expect(result.correctRate).toBe(1.0);
    // Topic with 100% rate is filtered out from byTopic
    const ts = result.byTopic.find((t) => t.topic === "typescript");
    expect(ts).toBeUndefined();
  });

  it("populates topicsWithHistory from history entries and unresolved_gaps", () => {
    const progress = {
      ...baseProgress,
      unresolved_gaps: [
        {
          questionId: "q_abc00010",
          concept: "race condition",
          topic: "concurrency",
          last_missed: "2026-03-05",
          task: "task-2",
          note: "mutex needed",
        },
      ],
    };
    const history = {
      history: [
        {
          id: "q_abc00001",
          reviewOf: null,
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "generics",
          question: "What are generics?",
          userAnswer: "Type params",
          isCorrect: true,
        },
      ],
    };
    const result = computeDashboardData(progress, history, topics);
    const sorted = [...result.topicsWithHistory].sort();
    expect(sorted).toEqual(["concurrency", "typescript"]);
  });

  it("returns empty topicsWithHistory when no entries or gaps exist", () => {
    const result = computeDashboardData(baseProgress, { history: [] }, topics);
    expect(result.topicsWithHistory).toEqual([]);
  });

  it("picks last in array order when answeredAt values are identical", () => {
    const history = {
      history: [
        {
          id: "q_abc00001",
          reviewOf: null,
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "generics",
          question: "What are generics?",
          userAnswer: "wrong",
          isCorrect: false,
        },
        {
          id: "q_abc00002",
          reviewOf: "q_abc00001",
          answeredAt: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "generics",
          question: "What are generics?",
          userAnswer: "Type parameters",
          isCorrect: true,
        },
      ],
    };

    const result = computeDashboardData(baseProgress, history, topics);
    expect(result.correctRate).toBe(1.0);
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
