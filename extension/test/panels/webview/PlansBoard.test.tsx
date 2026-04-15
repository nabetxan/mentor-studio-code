// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlansBoard,
  computeReorderedIds,
} from "../../../src/panels/webview/PlansBoard";
import type { UiPlan } from "../../../src/panels/webview/types";

afterEach(cleanup);

const plans: UiPlan[] = [
  {
    id: 1,
    name: "Plan A",
    filePath: "/work/a.md",
    status: "active",
    sortOrder: 1,
  },
  {
    id: 2,
    name: "Plan B",
    filePath: null,
    status: "queued",
    sortOrder: 2,
  },
  {
    id: 3,
    name: "Plan Done",
    filePath: "/work/done.md",
    status: "completed",
    sortOrder: 3,
  },
  {
    id: 4,
    name: "Plan Gone",
    filePath: null,
    status: "removed",
    sortOrder: 4,
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
      onActivatePlan={noop}
      onDeactivatePlan={noop}
      onRemovePlan={noop}
      onRestorePlan={noop}
      onOpenFile={noop}
      onReorder={noop}
      error={null}
      {...overrides}
    />,
  );
}

describe("PlansBoard", () => {
  it("renders active/queued/paused/backlog by default, hides completed and removed", () => {
    renderBoard();
    expect(screen.getByText("Plan A")).toBeTruthy();
    expect(screen.getByText("Plan B")).toBeTruthy();
    expect(screen.queryByText("Plan Done")).toBeNull();
    expect(screen.queryByText("Plan Gone")).toBeNull();
  });

  it("Show Completed checkbox reveals completed plan rows with ghost Activate", () => {
    renderBoard();
    fireEvent.click(screen.getByLabelText("show completed"));
    expect(screen.getByText("Plan Done")).toBeTruthy();
    // The completed row's Activate button should have variant ghost
    const toggles = screen.getAllByTestId("plan-toggle-active");
    const completedToggle = toggles.find(
      (btn) =>
        btn.textContent === "Activate" &&
        btn
          .closest("[data-testid='plan-row']")
          ?.textContent?.includes("Plan Done"),
    );
    expect(completedToggle).toBeTruthy();
    expect(completedToggle?.getAttribute("data-variant")).toBe("ghost");
  });

  it("Show Removed checkbox reveals removed plan rows with Restore button", () => {
    renderBoard();
    fireEvent.click(screen.getByLabelText("show removed"));
    expect(screen.getByText("Plan Gone")).toBeTruthy();
    expect(screen.getByTestId("plan-restore")).toBeTruthy();
    // removed rows don't show Activate/Deactivate or Remove
    const rows = screen.getAllByTestId("plan-row");
    const removedRow = rows.find((r) => r.textContent?.includes("Plan Gone"));
    expect(removedRow).toBeTruthy();
    expect(
      removedRow?.querySelector("[data-testid='plan-toggle-active']"),
    ).toBeNull();
    expect(removedRow?.querySelector("[data-testid='plan-remove']")).toBeNull();
  });

  it("Activate button on a queued plan calls onActivatePlan(id)", () => {
    const onActivate = vi.fn();
    renderBoard({ onActivatePlan: onActivate });
    const toggles = screen.getAllByTestId("plan-toggle-active");
    // index 1 = Plan B (queued) — label Activate
    expect(toggles[1]?.textContent).toBe("Activate");
    fireEvent.click(toggles[1]!);
    expect(onActivate).toHaveBeenCalledWith(2);
  });

  it("Deactivate on active plan calls onDeactivatePlan(id)", () => {
    const onDeactivate = vi.fn();
    renderBoard({ onDeactivatePlan: onDeactivate });
    const toggles = screen.getAllByTestId("plan-toggle-active");
    expect(toggles[0]?.textContent).toBe("Deactivate");
    fireEvent.click(toggles[0]!);
    expect(onDeactivate).toHaveBeenCalledWith(1);
  });

  it("Remove button calls onRemovePlan with id", () => {
    const onRemove = vi.fn();
    renderBoard({ onRemovePlan: onRemove });
    const dels = screen.getAllByTestId("plan-remove");
    fireEvent.click(dels[1]!);
    expect(onRemove).toHaveBeenCalledWith(2);
  });

  it("Restore button on removed plan calls onRestorePlan(id)", () => {
    const onRestore = vi.fn();
    renderBoard({ onRestorePlan: onRestore });
    fireEvent.click(screen.getByLabelText("show removed"));
    fireEvent.click(screen.getByTestId("plan-restore"));
    expect(onRestore).toHaveBeenCalledWith(4);
  });

  it("open button appears only for plans with filePath and calls onOpenFile", () => {
    const onOpen = vi.fn();
    renderBoard({ onOpenFile: onOpen });
    const openBtns = screen.getAllByLabelText("open plan file");
    // Plan A has filePath; Plan B doesn't; Plan Done/Gone hidden by default
    expect(openBtns).toHaveLength(1);
    fireEvent.click(openBtns[0]!);
    expect(onOpen).toHaveBeenCalledWith("/work/a.md");
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

  it("computeReorderedIds reorders correctly", () => {
    expect(computeReorderedIds([1, 2, 3], 1, 3)).toEqual([2, 3, 1]);
    expect(computeReorderedIds([1, 2, 3], 3, 1)).toEqual([3, 1, 2]);
    expect(computeReorderedIds([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
    expect(computeReorderedIds([1, 2, 3], 99, 2)).toEqual([1, 2, 3]);
  });
});
