// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusMenu } from "../../../src/panels/webview/StatusMenu";

afterEach(cleanup);

function renderMenu(
  overrides: Partial<React.ComponentProps<typeof StatusMenu>> = {},
): void {
  render(
    <StatusMenu
      currentStatus="queued"
      onSelect={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

describe("StatusMenu", () => {
  it("renders 6 status items", () => {
    renderMenu();
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(6);
  });

  it("marks current status with a checkmark", () => {
    renderMenu({ currentStatus: "paused" });
    const items = screen.getAllByRole("menuitem");
    const pausedItem = items.find((i) => i.textContent?.includes("Paused"));
    expect(pausedItem?.textContent).toContain("✓");
  });

  it("other items do not have checkmark", () => {
    renderMenu({ currentStatus: "queued" });
    const items = screen.getAllByRole("menuitem");
    const activeItem = items.find((i) => i.textContent?.includes("Active"));
    expect(activeItem?.textContent).not.toContain("✓");
  });

  it("clicking an item calls onSelect with the status", () => {
    const onSelect = vi.fn();
    renderMenu({ onSelect });
    const items = screen.getAllByRole("menuitem");
    const pausedItem = items.find((i) => i.textContent?.includes("Paused"));
    fireEvent.click(pausedItem!);
    expect(onSelect).toHaveBeenCalledWith("paused");
  });

  it("clicking same status as current calls onClose (no-op)", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderMenu({ currentStatus: "queued", onSelect, onClose });
    const items = screen.getAllByRole("menuitem");
    const queuedItem = items.find((i) => i.textContent?.includes("Queued"));
    fireEvent.click(queuedItem!);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape key calls onClose", () => {
    const onClose = vi.fn();
    renderMenu({ onClose });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("ArrowDown + Enter selects next item", () => {
    const onSelect = vi.fn();
    renderMenu({ currentStatus: "active", onSelect });
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("queued");
  });

  it("ArrowUp + Enter selects previous item", () => {
    const onSelect = vi.fn();
    renderMenu({ currentStatus: "paused", onSelect });
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("queued");
  });

  it("displays items in correct order: active, queued, paused, backlog, completed, removed", () => {
    renderMenu();
    const items = screen.getAllByRole("menuitem");
    const labels = items.map((i) => i.textContent?.replace("✓ ", "").trim());
    expect(labels).toEqual([
      "Active",
      "Queued",
      "Paused",
      "Backlog",
      "Completed",
      "Removed",
    ]);
  });
});
