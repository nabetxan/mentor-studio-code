// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanRow } from "../../../src/panels/webview/PlanRow";
import type { UiPlan } from "../../../src/panels/webview/types";

type Props = React.ComponentProps<typeof PlanRow>;

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  }),
}));

afterEach(cleanup);

const basePlan: UiPlan = {
  id: 1,
  name: "Test Plan",
  filePath: "/work/plan.md",
  status: "queued",
  sortOrder: 1,
};

function renderRow(overrides: Partial<Props> = {}): {
  rerender: (next: Partial<Props>) => void;
} {
  const defaults: Props = {
    plan: basePlan,
    reorderable: true,
    onRename: vi.fn(),
    onSetStatus: vi.fn(),
    onOpenFile: vi.fn(),
  };
  const result = render(<PlanRow {...defaults} {...overrides} />);
  return {
    rerender: (next) =>
      result.rerender(<PlanRow {...defaults} {...overrides} {...next} />),
  };
}

describe("PlanRow", () => {
  it("does NOT render Activate/Deactivate/Remove/Restore buttons", () => {
    renderRow();
    expect(screen.queryByTestId("plan-toggle-active")).toBeNull();
    expect(screen.queryByTestId("plan-remove")).toBeNull();
    expect(screen.queryByTestId("plan-restore")).toBeNull();
  });

  it("renders a badge button showing the status label", () => {
    renderRow();
    const badge = screen.getByTestId("plan-status-btn");
    expect(badge.textContent).toContain("Queued");
    expect(badge.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("clicking badge button opens StatusMenu", () => {
    renderRow();
    fireEvent.click(screen.getByTestId("plan-status-btn"));
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("selecting a status in StatusMenu calls onSetStatus", () => {
    const onSetStatus = vi.fn();
    renderRow({ onSetStatus });
    fireEvent.click(screen.getByTestId("plan-status-btn"));
    const items = screen.getAllByRole("menuitem");
    const pausedItem = items.find((i) => i.textContent?.includes("Paused"));
    fireEvent.click(pausedItem!);
    expect(onSetStatus).toHaveBeenCalledWith("paused");
  });

  it("drag handle is visible when reorderable=true", () => {
    renderRow({ reorderable: true });
    const handle = screen.getByTestId("plan-handle");
    expect(handle.style.visibility).not.toBe("hidden");
  });

  it("drag handle is hidden (but takes space) when reorderable=false", () => {
    renderRow({ reorderable: false });
    const handle = screen.getByTestId("plan-handle");
    expect(handle.style.visibility).toBe("hidden");
  });

  it("active plan badge uses active style", () => {
    renderRow({ plan: { ...basePlan, status: "active" } });
    const badge = screen.getByTestId("plan-status-btn");
    expect(badge.textContent).toContain("Active");
  });

  it("open button appears only for plans with filePath", () => {
    renderRow();
    expect(screen.getByLabelText("open plan file")).toBeTruthy();
  });

  it("open button does not appear when filePath is null", () => {
    renderRow({ plan: { ...basePlan, filePath: null } });
    expect(screen.queryByLabelText("open plan file")).toBeNull();
  });

  it("input reflects latest plan.name after prop change while idle", () => {
    const { rerender } = renderRow();
    rerender({ plan: { ...basePlan, name: "Renamed Externally" } });
    fireEvent.doubleClick(screen.getByText("Renamed Externally"));
    const input = screen.getByLabelText("plan name input") as HTMLInputElement;
    expect(input.value).toBe("Renamed Externally");
  });
});
