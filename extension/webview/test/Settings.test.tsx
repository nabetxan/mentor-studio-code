import type { MentorStudioConfig } from "@mentor-studio/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Settings } from "../src/components/Settings";

vi.mock("../src/vscodeApi", () => ({
  postMessage: vi.fn(),
}));

describe("Settings", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows unset state when config is null", () => {
    render(<Settings config={null} />);
    const warnings = screen.getAllByText("⚠ 未設定");
    expect(warnings).toHaveLength(2);
  });

  it("shows unset state when mentorFiles are not set", () => {
    const config: MentorStudioConfig = {
      repositoryName: "test",
      topics: [],
    };
    render(<Settings config={config} />);
    const warnings = screen.getAllByText("⚠ 未設定");
    expect(warnings).toHaveLength(2);
  });

  it("shows file paths when set", () => {
    const config: MentorStudioConfig = {
      repositoryName: "test",
      topics: [],
      mentorFiles: {
        appDesign: "docs/app-design.md",
        roadmap: "docs/roadmap.md",
      },
    };
    render(<Settings config={config} />);
    expect(screen.getByText("docs/app-design.md")).toBeTruthy();
    expect(screen.getByText("docs/roadmap.md")).toBeTruthy();
  });

  it("sends selectFile message on Select File click", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    render(<Settings config={null} />);

    const selectButtons = screen.getAllByText("Select File");
    fireEvent.click(selectButtons[0]);

    expect(postMessage).toHaveBeenCalledWith({
      type: "selectFile",
      field: "appDesign",
    });
  });

  it("sends clearFile message on clear click", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    const config: MentorStudioConfig = {
      repositoryName: "test",
      topics: [],
      mentorFiles: {
        appDesign: "docs/app-design.md",
        roadmap: null,
      },
    };
    render(<Settings config={config} />);

    const clearButton = screen.getByTitle("Clear setting");
    fireEvent.click(clearButton);

    expect(postMessage).toHaveBeenCalledWith({
      type: "clearFile",
      field: "appDesign",
    });
  });
});
