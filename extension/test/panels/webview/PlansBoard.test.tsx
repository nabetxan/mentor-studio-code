// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlansBoard,
  computeReorderedIds,
  getTaskDisplaySections,
} from "../../../src/panels/webview/PlansBoard";
import type { UiPlan, UiTask } from "../../../src/panels/webview/types";

afterEach(cleanup);

const plans: UiPlan[] = [
  {
    id: 1,
    name: "Plan Active",
    filePath: "/a.md",
    status: "active",
    sortOrder: 1,
  },
  {
    id: 2,
    name: "Plan Queued",
    filePath: null,
    status: "queued",
    sortOrder: 2,
  },
  {
    id: 3,
    name: "Plan Paused",
    filePath: null,
    status: "paused",
    sortOrder: 3,
  },
  {
    id: 4,
    name: "Plan Backlog",
    filePath: null,
    status: "backlog",
    sortOrder: 4,
  },
  {
    id: 5,
    name: "Plan Done",
    filePath: "/d.md",
    status: "completed",
    sortOrder: 5,
  },
  { id: 6, name: "Plan Gone", filePath: null, status: "removed", sortOrder: 6 },
];

const activePlanTasks: UiTask[] = [
  {
    id: 1,
    planId: 1,
    name: "Task 1",
    status: "completed",
    sortOrder: 1,
  },
  {
    id: 2,
    planId: 1,
    name: "Task 2",
    status: "active",
    sortOrder: 2,
  },
  {
    id: 3,
    planId: 1,
    name: "Task 3",
    status: "queued",
    sortOrder: 3,
  },
];

function noop(): void {}

function renderBoard(
  overrides: Partial<React.ComponentProps<typeof PlansBoard>> = {},
): void {
  render(
    <PlansBoard
      plans={plans}
      onCreatePlanFromFile={noop}
      onRenamePlan={noop}
      onSetPlanStatus={noop}
      onOpenFile={noop}
      onReorder={noop}
      error={null}
      {...overrides}
    />,
  );
}

describe("PlansBoard (grouped)", () => {
  it("renders all 6 group headers", () => {
    renderBoard();
    // PlanGroup aria-labels follow "Label (N)" pattern
    expect(screen.getByRole("button", { name: /^Active \(/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Queued \(/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Paused \(/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Backlog \(/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Completed \(/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Removed \(/ })).toBeTruthy();
  });

  it("Active/Queued/Paused/Backlog groups are open by default, Completed/Removed are closed", () => {
    renderBoard();
    expect(screen.getByText("Plan Active")).toBeTruthy();
    expect(screen.getByText("Plan Queued")).toBeTruthy();
    expect(screen.getByText("Plan Paused")).toBeTruthy();
    expect(screen.getByText("Plan Backlog")).toBeTruthy();
    expect(screen.queryByText("Plan Done")).toBeNull();
    expect(screen.queryByText("Plan Gone")).toBeNull();
  });

  it("clicking Completed header expands it", () => {
    renderBoard();
    const completedHeader = screen.getByRole("button", { name: /Completed/ });
    fireEvent.click(completedHeader);
    expect(screen.getByText("Plan Done")).toBeTruthy();
  });

  it("empty group is disabled", () => {
    renderBoard({ plans: [plans[0]] });
    const queuedHeader = screen.getByRole("button", { name: /Queued/ });
    expect(queuedHeader.getAttribute("aria-disabled")).toBe("true");
  });

  it("plans with status queued/paused/backlog have visible drag handles", () => {
    renderBoard();
    const rows = screen.getAllByTestId("plan-row");
    const queuedRow = rows.find((r) => r.textContent?.includes("Plan Queued"));
    const handle = queuedRow?.querySelector(
      "[data-testid='plan-handle']",
    ) as HTMLElement;
    expect(handle?.style.visibility).not.toBe("hidden");
  });

  it("plans in active group have hidden drag handles", () => {
    renderBoard();
    const rows = screen.getAllByTestId("plan-row");
    const activeRow = rows.find((r) => r.textContent?.includes("Plan Active"));
    const handle = activeRow?.querySelector(
      "[data-testid='plan-handle']",
    ) as HTMLElement;
    expect(handle?.style.visibility).toBe("hidden");
  });

  it("keeps completed earlier tasks above the active task", () => {
    renderBoard({ tasks: activePlanTasks });
    const rows = screen.getAllByTestId("task-row");
    expect(rows[0].textContent).toContain("Task 1");
    expect(rows[1].textContent).toContain("Task 2");
    expect(rows[2].textContent).toContain("Task 3");
  });

  it("keeps queued tasks before history when no task is active", () => {
    renderBoard({
      tasks: [
        {
          id: 1,
          planId: 1,
          name: "Task 1",
          status: "completed",
          sortOrder: 1,
        },
        {
          id: 2,
          planId: 1,
          name: "Task 2",
          status: "queued",
          sortOrder: 2,
        },
        {
          id: 3,
          planId: 1,
          name: "Task 3",
          status: "skipped",
          sortOrder: 3,
        },
      ],
    });

    const rows = screen.getAllByTestId("task-row");
    expect(rows[0].textContent).toContain("Task 2");
    expect(rows[1].textContent).toContain("Task 1");
    expect(rows[2].textContent).toContain("Task 3");
  });

  it("shows status icons in the handle column for active and completed tasks", () => {
    renderBoard({ tasks: activePlanTasks });
    const rows = screen.getAllByTestId("task-row");
    expect(
      rows[0].querySelector("[data-testid='task-status-icon']")?.textContent,
    ).toBe("✓");
    expect(
      rows[1].querySelector("[data-testid='task-status-icon']")?.textContent,
    ).toBe("▶");
    expect(
      rows[2].querySelector("[data-testid='task-handle']")?.textContent,
    ).toBe("≡");
  });

  it("does not expose task deletion from the Plan Panel task rows", () => {
    renderBoard({ tasks: activePlanTasks });
    const rows = screen.getAllByTestId("task-row");
    expect(rows[0].textContent).not.toContain("Delete");
    expect(rows[1].textContent).not.toContain("Delete");
    expect(rows[2].textContent).not.toContain("Delete");
  });

  it("Add Plan from File button calls onCreatePlanFromFile", () => {
    const onCreate = vi.fn();
    renderBoard({ onCreatePlanFromFile: onCreate });
    fireEvent.click(screen.getByTestId("plan-add-from-file"));
    expect(onCreate).toHaveBeenCalled();
  });

  it("renders error message when provided", () => {
    renderBoard({ error: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("computeReorderedIds still works", () => {
    expect(computeReorderedIds([1, 2, 3], 1, 3)).toEqual([2, 3, 1]);
    expect(computeReorderedIds([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
  });

  it("groups task display sections without treating no-active state as history-first", () => {
    const sections = getTaskDisplaySections([
      {
        id: 1,
        planId: 1,
        name: "Task 1",
        status: "completed",
        sortOrder: 1,
      },
      {
        id: 2,
        planId: 1,
        name: "Task 2",
        status: "queued",
        sortOrder: 2,
      },
      {
        id: 3,
        planId: 1,
        name: "Task 3",
        status: "skipped",
        sortOrder: 3,
      },
    ]);

    expect(sections.leadingHistoryTasks).toEqual([]);
    expect(sections.queuedTasks.map((task) => task.id)).toEqual([2]);
    expect(sections.trailingHistoryTasks.map((task) => task.id)).toEqual([
      1, 3,
    ]);
  });

  it("no Show Completed / Show Removed checkboxes", () => {
    renderBoard();
    expect(screen.queryByLabelText("show completed")).toBeNull();
    expect(screen.queryByLabelText("show removed")).toBeNull();
  });
});
