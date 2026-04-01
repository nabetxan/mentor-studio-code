import type { DashboardData } from "@mentor-studio/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Overview } from "../src/components/Overview";

vi.mock("../src/vscodeApi", () => ({
  postMessage: vi.fn(),
}));

const mockData: DashboardData = {
  totalQuestions: 10,
  correctRate: 0.7,
  byTopic: [],
  unresolvedGaps: [],
  completedTasks: [],
  currentTask: "3",
  profileLastUpdated: null,
};

const defaultProps = {
  data: mockData,
  locale: "ja" as const,
  config: null,
  addTopicError: null,
  lastAddedTopicKey: null,
  onClearLastAddedKey: () => {},
};

describe("Overview", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state in Japanese when data is null", () => {
    render(<Overview {...defaultProps} data={null} />);
    expect(screen.getByText("データなし")).toBeTruthy();
  });

  it("shows empty state in English when data is null", () => {
    render(<Overview {...defaultProps} data={null} locale="en" />);
    expect(screen.getByText("No data yet")).toBeTruthy();
  });

  it("renders labels in Japanese", () => {
    render(<Overview {...defaultProps} />);
    expect(screen.getByText("回答数")).toBeTruthy();
    expect(screen.getByText("正答率")).toBeTruthy();
    expect(screen.getByText("現在のタスク")).toBeTruthy();
  });

  it("renders labels in English", () => {
    render(<Overview {...defaultProps} locale="en" />);
    expect(screen.getByText("Total Questions")).toBeTruthy();
    expect(screen.getByText("Correct Rate")).toBeTruthy();
    expect(screen.getByText("Current Task")).toBeTruthy();
  });

  it("renders stats from data", () => {
    render(<Overview {...defaultProps} />);
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("Task 3")).toBeTruthy();
  });

  it("shows not-started in Japanese when currentTask is null", () => {
    render(
      <Overview {...defaultProps} data={{ ...mockData, currentTask: null }} />,
    );
    expect(screen.getByText("未開始")).toBeTruthy();
  });

  it("shows not-started in English when currentTask is null", () => {
    render(
      <Overview
        {...defaultProps}
        data={{ ...mockData, currentTask: null }}
        locale="en"
      />,
    );
    expect(screen.getByText("Not started")).toBeTruthy();
  });

  it("renders unresolved gaps inside expanded topic", () => {
    const data: DashboardData = {
      totalQuestions: 1,
      correctRate: 0,
      byTopic: [
        {
          topic: "javascript",
          label: "JavaScript",
          total: 1,
          correct: 0,
          rate: 0,
        },
      ],
      unresolvedGaps: [
        {
          questionId: "q1",
          concept: "closures",
          topic: "javascript",
          last_missed: "2026-03-01",
          task: "task-1",
          note: "confused about scope",
        },
      ],
      completedTasks: [],
      currentTask: "1",
      profileLastUpdated: null,
    };
    render(
      <Overview
        {...defaultProps}
        data={data}
        config={{
          repositoryName: "test",
          topics: [{ key: "javascript", label: "JavaScript" }],
        }}
      />,
    );
    // Expand the topic
    fireEvent.click(screen.getByText("JavaScript"));
    expect(screen.getByText("closures")).toBeTruthy();
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
      profileLastUpdated: null,
    };
    render(<Overview {...defaultProps} data={data} />);
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByText("2/3問")).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("1/2問")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });
});
