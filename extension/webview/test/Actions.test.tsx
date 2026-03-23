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

  it("renders all snippet actions", () => {
    render(<Actions />);
    expect(screen.getByText("Start next task")).toBeTruthy();
    expect(screen.getByText("Review implementation")).toBeTruthy();
    expect(screen.getByText("Start 復習")).toBeTruthy();
    expect(screen.getByText("Start 理解度チェック")).toBeTruthy();
  });

  it("copies prompt to clipboard on click", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    render(<Actions />);

    const buttons = screen.getAllByTitle("Copy prompt to clipboard");
    fireEvent.click(buttons[0]);

    expect(postMessage).toHaveBeenCalledWith({
      type: "copy",
      text: expect.stringContaining("次のタスクを始めてください"),
    });
  });
});
