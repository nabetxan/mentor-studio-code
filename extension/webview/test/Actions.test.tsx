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
    expect(screen.getByText("次のタスクを始める")).toBeTruthy();
    expect(screen.getByText("実装をレビューする")).toBeTruthy();
    expect(screen.getByText("復習を始める")).toBeTruthy();
    expect(screen.getByText("理解度チェックを始める")).toBeTruthy();
  });

  it("renders all snippet actions in English", () => {
    render(<Actions locale="en" />);
    expect(screen.getByText("Start next task")).toBeTruthy();
    expect(screen.getByText("Review implementation")).toBeTruthy();
    expect(screen.getByText("Start review")).toBeTruthy();
    expect(screen.getByText("Start Comprehension check")).toBeTruthy();
  });

  it("shows copy icon by default, not check icon", () => {
    render(<Actions locale="ja" />);
    expect(screen.queryByText("Copied!")).toBeNull();
  });

  it("shows check icon after click", () => {
    render(<Actions locale="ja" />);
    const button = screen.getByText("次のタスクを始める").closest("button");
    fireEvent.click(button!);
    expect(screen.getByText("Copied!")).toBeTruthy();
  });

  it("copies prompt to clipboard on click", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    render(<Actions locale="ja" />);

    const button = screen.getByText("次のタスクを始める").closest("button");
    fireEvent.click(button!);

    expect(postMessage).toHaveBeenCalledWith({
      type: "copy",
      text: expect.stringContaining("次のタスクを始めましょう"),
    });
  });
});
