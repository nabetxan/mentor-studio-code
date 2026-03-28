import type { DashboardData } from "@mentor-studio/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Overview } from "../src/components/Overview";

const mockData: DashboardData = {
  totalQuestions: 10,
  correctRate: 0.7,
  byTopic: [],
  unresolvedGaps: [],
  completedTasks: [],
  currentTask: "3",
};

describe("Overview", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state in Japanese when data is null", () => {
    render(<Overview data={null} locale="ja" />);
    expect(screen.getByText("データなし")).toBeTruthy();
  });

  it("shows empty state in English when data is null", () => {
    render(<Overview data={null} locale="en" />);
    expect(screen.getByText("No data yet")).toBeTruthy();
  });

  it("renders labels in Japanese", () => {
    render(<Overview data={mockData} locale="ja" />);
    expect(screen.getByText("回答数")).toBeTruthy();
    expect(screen.getByText("正答率")).toBeTruthy();
    expect(screen.getByText("現在のタスク")).toBeTruthy();
  });

  it("renders labels in English", () => {
    render(<Overview data={mockData} locale="en" />);
    expect(screen.getByText("Total Questions")).toBeTruthy();
    expect(screen.getByText("Correct Rate")).toBeTruthy();
    expect(screen.getByText("Current Task")).toBeTruthy();
  });

  it("renders stats from data", () => {
    render(<Overview data={mockData} locale="ja" />);
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("Task 3")).toBeTruthy();
  });

  it("shows not-started in Japanese when currentTask is null", () => {
    render(<Overview data={{ ...mockData, currentTask: null }} locale="ja" />);
    expect(screen.getByText("未開始")).toBeTruthy();
  });

  it("shows not-started in English when currentTask is null", () => {
    render(<Overview data={{ ...mockData, currentTask: null }} locale="en" />);
    expect(screen.getByText("Not started")).toBeTruthy();
  });

  it("renders unresolved gaps", () => {
    const data: DashboardData = {
      totalQuestions: 1,
      correctRate: 0,
      byTopic: [],
      unresolvedGaps: [
        {
          concept: "closures",
          topic: "javascript",
          first_missed: "2026-03-01",
          task: "task-1",
          note: "confused about scope",
        },
      ],
      completedTasks: [],
      currentTask: "1",
    };
    render(<Overview data={data} locale="ja" />);
    expect(screen.getByText("closures")).toBeTruthy();
    expect(screen.getByText("confused about scope")).toBeTruthy();
  });

  it("renders topic progress bars", () => {
    const data: DashboardData = {
      totalQuestions: 5,
      correctRate: 0.6,
      byTopic: [
        { topic: "ts", label: "TypeScript", total: 3, correct: 2, rate: 0.667 },
        { topic: "react", label: "React", total: 2, correct: 1, rate: 0.5 },
      ],
      unresolvedGaps: [],
      completedTasks: [],
      currentTask: "2",
    };
    render(<Overview data={data} locale="ja" />);
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByText("2/3 (67%)")).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("1/2 (50%)")).toBeTruthy();
  });
});
