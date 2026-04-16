import type { DashboardData, PlanDto } from "@mentor-studio/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Overview } from "../src/components/Overview";

vi.mock("../src/vscodeApi", () => ({
  postMessage: vi.fn(),
}));

const mockData: DashboardData = {
  totalQuestions: 10,
  correctRate: 0.7,
  byTopic: [],
  allTopics: [],
  unresolvedGaps: [],
  completedTasks: [],
  currentTask: "3",
  profileLastUpdated: null,
  topicsWithHistory: [],
  plans: [],
  activePlan: null,
};

const defaultProps = {
  data: mockData,
  locale: "ja" as const,
  config: null,
  addTopicError: null,
  lastAddedTopicKey: null,
  onClearLastAddedKey: () => {},
  deleteTopicErrors: new Map<string, string>(),
  onClearDeleteTopicErrors: vi.fn(),
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
      allTopics: [{ key: "javascript", label: "JavaScript" }],
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
      topicsWithHistory: ["javascript"],
      plans: [],
      activePlan: null,
    };
    render(<Overview {...defaultProps} data={data} />);
    // Expand the topic
    fireEvent.click(screen.getByText("JavaScript"));
    expect(screen.getByText("closures")).toBeTruthy();
  });

  describe("Active plan display", () => {
    it("shows 'no active plan' warning when activePlan is null", () => {
      render(<Overview {...defaultProps} />);
      expect(
        screen.getByText(
          "アクティブなプランがありません — `add-plan` CLI またはプランパネルで作成してください",
        ),
      ).toBeTruthy();
    });

    it("renders plan name as link when activePlan has filePath", async () => {
      const { postMessage } = await import("../src/vscodeApi");
      (postMessage as ReturnType<typeof vi.fn>).mockClear();
      const activePlan: PlanDto = {
        id: 1,
        name: "Phase 1",
        filePath: "docs/plan.md",
        status: "active",
        sortOrder: 0,
      };
      render(<Overview {...defaultProps} data={{ ...mockData, activePlan }} />);
      const link = screen.getByText("Phase 1");
      expect(link).toBeTruthy();
      fireEvent.click(link);
      expect(postMessage).toHaveBeenCalledWith({
        type: "openFile",
        relativePath: "docs/plan.md",
      });
    });

    it("renders plan name with UI-only label when filePath is null", () => {
      const activePlan: PlanDto = {
        id: 2,
        name: "Sketch",
        filePath: null,
        status: "active",
        sortOrder: 0,
      };
      render(<Overview {...defaultProps} data={{ ...mockData, activePlan }} />);
      expect(screen.getByText(/Sketch/)).toBeTruthy();
      expect(screen.getByText(/\(UIのみのプラン\)/)).toBeTruthy();
    });
  });

  it("renders topic progress bars", () => {
    const data: DashboardData = {
      totalQuestions: 5,
      correctRate: 0.6,
      byTopic: [
        { topic: "ts", label: "TypeScript", total: 3, correct: 2, rate: 0.667 },
        { topic: "react", label: "React", total: 2, correct: 1, rate: 0.5 },
      ],
      allTopics: [],
      unresolvedGaps: [],
      completedTasks: [],
      currentTask: "2",
      profileLastUpdated: null,
      topicsWithHistory: [],
      plans: [],
      activePlan: null,
    };
    render(<Overview {...defaultProps} data={data} />);
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByText("2/3問")).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("1/2問")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  describe("Delete Topics section", () => {
    const dataWithTopics: DashboardData = {
      ...mockData,
      allTopics: [
        { key: "ts", label: "TypeScript" },
        { key: "react", label: "React" },
        { key: "css", label: "CSS" },
      ],
    };

    it("renders delete section when topics exist", () => {
      render(<Overview {...defaultProps} data={dataWithTopics} />);
      expect(screen.getByText("トピックの削除")).toBeTruthy();
    });

    it("does not render delete section when no topics", () => {
      render(<Overview {...defaultProps} />);
      expect(screen.queryByText("トピックの削除")).toBeNull();
    });

    it("disables topics that have history", () => {
      const data = {
        ...dataWithTopics,
        topicsWithHistory: ["ts"],
      };
      render(<Overview {...defaultProps} data={data} />);
      fireEvent.click(screen.getByText("削除するトピックを選択"));
      const checkboxes = screen.getAllByRole("checkbox");
      const tsCheckbox = checkboxes.find((cb) =>
        cb.closest("label")?.textContent?.includes("TypeScript"),
      ) as HTMLInputElement;
      expect(tsCheckbox.disabled).toBe(true);
    });

    it("shows 'no topics available' when all topics have history", () => {
      const data = {
        ...dataWithTopics,
        topicsWithHistory: ["ts", "react", "css"],
      };
      render(<Overview {...defaultProps} data={data} />);
      expect(
        screen.getByText(
          "すべてのトピックに学習データがあるため削除できません",
        ),
      ).toBeTruthy();
    });

    it("posts deleteTopics message with selected keys", async () => {
      const { postMessage } = await import("../src/vscodeApi");
      (postMessage as ReturnType<typeof vi.fn>).mockClear();
      render(<Overview {...defaultProps} data={dataWithTopics} />);
      fireEvent.click(screen.getByText("削除するトピックを選択"));
      const checkboxes = screen.getAllByRole("checkbox");
      const reactCheckbox = checkboxes.find((cb) =>
        cb.closest("label")?.textContent?.includes("React"),
      ) as HTMLInputElement;
      const cssCheckbox = checkboxes.find((cb) =>
        cb.closest("label")?.textContent?.includes("CSS"),
      ) as HTMLInputElement;
      fireEvent.click(reactCheckbox);
      fireEvent.click(cssCheckbox);
      fireEvent.click(screen.getByText("削除"));
      expect(postMessage).toHaveBeenCalledWith({
        type: "deleteTopics",
        keys: expect.arrayContaining(["react", "css"]),
      });
    });

    it("displays delete error text and dismiss button", () => {
      const errors = new Map([["ts", "削除できません"]]);
      const onClear = vi.fn();
      render(
        <Overview
          {...defaultProps}
          data={dataWithTopics}
          deleteTopicErrors={errors}
          onClearDeleteTopicErrors={onClear}
        />,
      );
      expect(screen.getByText("削除できません")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe("Merge Topics section", () => {
    const dataWithTopics: DashboardData = {
      ...mockData,
      allTopics: [
        { key: "ts", label: "TypeScript" },
        { key: "react", label: "React" },
      ],
    };

    it("renders merge section when 2+ topics exist", () => {
      render(<Overview {...defaultProps} data={dataWithTopics} />);
      expect(screen.getByText("トピックの統合")).toBeTruthy();
    });

    it("does not render merge section with only 1 topic", () => {
      render(
        <Overview
          {...defaultProps}
          data={{
            ...mockData,
            allTopics: [{ key: "ts", label: "TypeScript" }],
          }}
        />,
      );
      expect(screen.queryByText("トピックの統合")).toBeNull();
    });

    it("posts mergeTopic message when merge is executed", async () => {
      const { postMessage } = await import("../src/vscodeApi");
      (postMessage as ReturnType<typeof vi.fn>).mockClear();
      const { container } = render(
        <Overview {...defaultProps} data={dataWithTopics} />,
      );
      // Select source via the native <select> inside the merge section
      const mergeSection = container.querySelector(
        ".merge-topics-section",
      ) as HTMLElement;
      const sourceSelect = within(mergeSection).getByRole("combobox");
      fireEvent.change(sourceSelect, { target: { value: "ts" } });
      // Target uses TopicSelect (custom dropdown) — click the button then the option
      const targetButton = within(mergeSection).getByText("—");
      fireEvent.click(targetButton);
      const reactOptions = within(mergeSection).getAllByRole("option", {
        name: "React",
      });
      const reactButton = reactOptions.find(
        (el) => el.tagName === "BUTTON",
      ) as HTMLElement;
      fireEvent.click(reactButton);
      // Click merge
      fireEvent.click(within(mergeSection).getByText("統合"));
      expect(postMessage).toHaveBeenCalledWith({
        type: "mergeTopic",
        fromKey: "ts",
        toKey: "react",
      });
    });
  });
});
