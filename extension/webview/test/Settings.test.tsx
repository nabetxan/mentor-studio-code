import type { MentorStudioConfig } from "@mentor-studio/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Settings } from "../src/components/Settings";

vi.mock("../src/vscodeApi", () => ({
  postMessage: vi.fn(),
}));

const defaultProps = {
  config: null as MentorStudioConfig | null,
  locale: "ja" as const,
  onLocaleChange: () => {},
  profileLastUpdated: null as string | null,
};

describe("Settings", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows unset state when config is null", () => {
    render(<Settings {...defaultProps} />);
    const warnings = screen.getAllByText("⚠ 未設定");
    expect(warnings).toHaveLength(2);
  });

  it("shows unset state when mentorFiles are not set", () => {
    const config: MentorStudioConfig = {
      repositoryName: "test",
      topics: [],
    };
    render(<Settings {...defaultProps} config={config} />);
    const warnings = screen.getAllByText("⚠ 未設定");
    expect(warnings).toHaveLength(2);
  });

  it("shows file paths when set", () => {
    const config: MentorStudioConfig = {
      repositoryName: "test",
      topics: [],
      mentorFiles: {
        spec: "docs/app-design.md",
        plan: "docs/roadmap.md",
      },
    };
    render(<Settings {...defaultProps} config={config} />);
    expect(screen.getByText("docs/app-design.md")).toBeTruthy();
    expect(screen.getByText("docs/roadmap.md")).toBeTruthy();
  });

  it("sends selectFile message on Select File click", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    render(<Settings {...defaultProps} locale="en" />);

    const selectButtons = screen.getAllByText("Select File");
    fireEvent.click(selectButtons[0]);

    expect(postMessage).toHaveBeenCalledWith({
      type: "selectFile",
      field: "plan",
    });
  });

  it("sends clearFile message on clear click", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    const config: MentorStudioConfig = {
      repositoryName: "test",
      topics: [],
      mentorFiles: {
        spec: "docs/app-design.md",
        plan: null,
      },
    };
    render(<Settings {...defaultProps} config={config} />);

    const clearButton = screen.getByText("外す");
    fireEvent.click(clearButton);

    expect(postMessage).toHaveBeenCalledWith({
      type: "clearFile",
      field: "spec",
    });
  });

  it("renders language toggle", () => {
    render(<Settings {...defaultProps} />);
    expect(screen.getByText("Language / 言語")).toBeTruthy();
  });

  it("calls onLocaleChange when toggle clicked", () => {
    const onLocaleChange = vi.fn();
    render(<Settings {...defaultProps} onLocaleChange={onLocaleChange} />);
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(onLocaleChange).toHaveBeenCalledWith("en");
  });

  it("renders labels in English", () => {
    render(<Settings {...defaultProps} locale="en" />);
    const warnings = screen.getAllByText("⚠ Not set");
    expect(warnings).toHaveLength(2);
  });
});
