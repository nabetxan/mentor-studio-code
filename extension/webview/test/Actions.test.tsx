import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Actions } from "../src/components/Actions";

vi.mock("../src/vscodeApi", () => ({
  postMessage: vi.fn(),
}));

describe("Actions", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all snippet actions in Japanese", () => {
    render(<Actions locale="ja" />);
    expect(screen.getByText("Start next task")).toBeTruthy();
    expect(screen.getByText("Review implementation")).toBeTruthy();
    expect(screen.getByText("Start 復習")).toBeTruthy();
    expect(screen.getByText("Start 理解度チェック")).toBeTruthy();
  });

  it("renders all snippet actions in English", () => {
    render(<Actions locale="en" />);
    expect(screen.getByText("Start next task")).toBeTruthy();
    expect(screen.getByText("Review implementation")).toBeTruthy();
    expect(screen.getByText("Start review")).toBeTruthy();
    expect(screen.getByText("Start comprehension check")).toBeTruthy();
  });

  it("shows clippy icon by default, not copy icon", () => {
    const { container } = render(<Actions locale="ja" />);
    expect(container.querySelector(".codicon-clippy")).toBeTruthy();
    expect(container.querySelector(".codicon-copy")).toBeNull();
  });

  it("shows check icon after click", () => {
    const { container } = render(<Actions locale="ja" />);
    const button = screen.getByText("Start next task").closest("button");
    fireEvent.click(button!);
    expect(container.querySelector(".codicon-check")).toBeTruthy();
  });

  it("copies prompt to clipboard on click", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    render(<Actions locale="ja" />);

    const button = screen.getByText("Start next task").closest("button");
    fireEvent.click(button!);

    expect(postMessage).toHaveBeenCalledWith({
      type: "copy",
      text: expect.stringContaining("次のタスクを始めてください"),
    });
  });
});
