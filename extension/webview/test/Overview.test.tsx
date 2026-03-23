import type { DashboardData } from "@mentor-studio/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Overview } from "../src/components/Overview";

describe("Overview", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state when data is null", () => {
    render(<Overview data={null} />);
    expect(screen.getByText("No data yet")).toBeTruthy();
  });

  it("renders stats from data", () => {
    const data: DashboardData = {
      totalQuestions: 10,
      correctRate: 0.7,
      byTopic: [],
      unresolvedGaps: [],
      completedTasks: [],
      currentTask: "3",
    };
    render(<Overview data={data} />);
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("Task 3")).toBeTruthy();
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
    render(<Overview data={data} />);
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
    render(<Overview data={data} />);
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByText("2/3 (67%)")).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("1/2 (50%)")).toBeTruthy();
  });
});
