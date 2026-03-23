import type { TopicConfig } from "@mentor-studio/shared";
import { describe, expect, it } from "vitest";
import {
  computeDashboardData,
  parseProgressData,
  parseQuestionHistory,
} from "../src/services/dataParser";

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
      skipped_tasks: [],
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
  });

  it("returns null for invalid JSON", () => {
    expect(parseProgressData("not json")).toBeNull();
  });

  it("returns null for missing required fields", () => {
    expect(parseProgressData(JSON.stringify({ version: "2.0" }))).toBeNull();
  });
});

describe("parseQuestionHistory", () => {
  it("parses valid question history", () => {
    const json = JSON.stringify({
      history: [
        {
          timestamp: "2026-03-01T10:00:00Z",
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
    expect(result.history[0].isCorrect).toBe(false);
  });

  it("returns empty history for invalid JSON", () => {
    expect(parseQuestionHistory("broken").history).toEqual([]);
  });
});

describe("computeDashboardData", () => {
  const topics: TopicConfig[] = [
    { key: "typescript", label: "TypeScript" },
    { key: "react", label: "React" },
  ];

  it("computes correct stats from history and progress", () => {
    const progress = {
      version: "2.0",
      current_plan: "phase1.md",
      current_task: "2",
      current_step: null,
      next_suggest: "",
      resume_context: "",
      completed_tasks: [{ task: "1", name: "Setup", plan: "phase1.md" }],
      skipped_tasks: [],
      in_progress: [],
      unresolved_gaps: [
        {
          concept: "interface vs type",
          topic: "typescript",
          first_missed: "2026-03-01",
          task: "task-1",
          note: "confused extends vs &",
        },
      ],
    };
    const history = {
      history: [
        {
          timestamp: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "interface vs type",
          question: "Difference?",
          userAnswer: "extends",
          isCorrect: false,
        },
        {
          timestamp: "2026-03-01T11:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "generics",
          question: "What are generics?",
          userAnswer: "Type parameters",
          isCorrect: true,
        },
        {
          timestamp: "2026-03-02T10:00:00Z",
          taskId: "task-1",
          topic: "react",
          concept: "useState",
          question: "What does useState return?",
          userAnswer: "[value, setter]",
          isCorrect: true,
        },
      ],
    };

    const result = computeDashboardData(progress, history, topics);
    expect(result.totalQuestions).toBe(3);
    expect(result.correctRate).toBeCloseTo(0.667, 2);
    expect(result.byTopic).toHaveLength(2);

    const ts = result.byTopic.find((t) => t.topic === "typescript");
    expect(ts?.total).toBe(2);
    expect(ts?.correct).toBe(1);
    expect(ts?.rate).toBe(0.5);

    const react = result.byTopic.find((t) => t.topic === "react");
    expect(react?.total).toBe(1);
    expect(react?.correct).toBe(1);

    expect(result.unresolvedGaps).toHaveLength(1);
    expect(result.currentTask).toBe("2");
  });

  it("handles empty history", () => {
    const progress = {
      version: "2.0",
      current_plan: "phase1.md",
      current_task: "1",
      current_step: null,
      next_suggest: "",
      resume_context: "",
      completed_tasks: [],
      skipped_tasks: [],
      in_progress: [],
      unresolved_gaps: [],
    };
    const result = computeDashboardData(progress, { history: [] }, topics);
    expect(result.totalQuestions).toBe(0);
    expect(result.correctRate).toBe(0);
    expect(result.byTopic).toEqual([]);
  });
});
