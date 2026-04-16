import type { MentorStudioConfig, PlanDto } from "@mentor-studio/shared";
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
  activePlan: null as PlanDto | null,
  planActionError: null as string | null,
};

describe("Settings", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows unset state when config is null", () => {
    render(<Settings {...defaultProps} />);
    // Spec is the only config-driven file field remaining
    const warnings = screen.getAllByText("⚠ 未設定");
    expect(warnings).toHaveLength(1);
    // Active plan shows its own "(no active plan)" warning text
    expect(screen.getByText("(アクティブなプランなし)")).toBeTruthy();
  });

  it("shows unset state when mentorFiles are not set", () => {
    const config: MentorStudioConfig = {
      repositoryName: "test",
    };
    render(<Settings {...defaultProps} config={config} />);
    const warnings = screen.getAllByText("⚠ 未設定");
    expect(warnings).toHaveLength(1);
  });

  it("shows spec file path when set", () => {
    const config: MentorStudioConfig = {
      repositoryName: "test",
      mentorFiles: {
        spec: "docs/app-design.md",
      },
    };
    render(<Settings {...defaultProps} config={config} />);
    expect(screen.getByText("docs/app-design.md")).toBeTruthy();
  });

  it("renders active plan filePath link when activePlan has a filePath", () => {
    const activePlan: PlanDto = {
      id: 1,
      name: "Phase 1",
      filePath: "docs/roadmap.md",
      status: "active",
      sortOrder: 0,
    };
    render(<Settings {...defaultProps} activePlan={activePlan} />);
    expect(screen.getByText("docs/roadmap.md")).toBeTruthy();
  });

  it("renders active plan with UI-only label when filePath is null", () => {
    const activePlan: PlanDto = {
      id: 2,
      name: "Sketch",
      filePath: null,
      status: "active",
      sortOrder: 0,
    };
    render(<Settings {...defaultProps} activePlan={activePlan} />);
    expect(screen.getByText("(UIのみのプラン)")).toBeTruthy();
  });

  it("renders (no active plan) warning when activePlan is null", () => {
    render(<Settings {...defaultProps} activePlan={null} />);
    expect(screen.getByText("(アクティブなプランなし)")).toBeTruthy();
  });

  it("sends selectFile field:plan on the active-plan Select File click", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    render(<Settings {...defaultProps} locale="en" />);

    const selectButtons = screen.getAllByText("Select File");
    // First button belongs to ActivePlanSetting (plan), second to spec FileSetting
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
      mentorFiles: {
        spec: "docs/app-design.md",
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
    expect(warnings).toHaveLength(1);
    expect(screen.getByText("(no active plan)")).toBeTruthy();
  });

  it("renders Uninstall Guide section", () => {
    render(<Settings {...defaultProps} />);
    expect(screen.getByText("アンインストール手順")).toBeTruthy();
  });

  it("expands details and sends cleanupMentor message", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    render(<Settings {...defaultProps} />);

    // Expand details
    fireEvent.click(screen.getByText("詳しく見る"));

    // Click cleanup button (profile and claudeMdRef are checked by default)
    fireEvent.click(screen.getByText("データ消去"));

    expect(postMessage).toHaveBeenCalledWith({
      type: "cleanupMentor",
      options: { mentorFolder: false, profile: true, claudeMdRef: true },
    });
  });

  it("renders Uninstall Guide in English", () => {
    render(<Settings {...defaultProps} locale="en" />);
    expect(screen.getByText("Uninstall Guide")).toBeTruthy();
  });

  it("sends pauseActivePlan message when Detach (外す) is clicked", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    const activePlan: PlanDto = {
      id: 7,
      name: "Phase 1",
      filePath: "docs/roadmap.md",
      status: "active",
      sortOrder: 0,
    };
    render(<Settings {...defaultProps} activePlan={activePlan} />);
    fireEvent.click(screen.getByText("外す"));
    expect(postMessage).toHaveBeenCalledWith({
      type: "pauseActivePlan",
      id: 7,
    });
  });

  it("sends changeActivePlanFile message when Change (変更) is clicked", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    const activePlan: PlanDto = {
      id: 9,
      name: "Phase 2",
      filePath: "docs/p2.md",
      status: "active",
      sortOrder: 0,
    };
    render(<Settings {...defaultProps} activePlan={activePlan} />);
    fireEvent.click(screen.getByText("変更"));
    expect(postMessage).toHaveBeenCalledWith({
      type: "changeActivePlanFile",
      id: 9,
    });
  });

  it("shows planActionError when provided", () => {
    render(
      <Settings
        {...defaultProps}
        activePlan={null}
        planActionError="プランの有効化に失敗しました: tasks required"
      />,
    );
    expect(
      screen.getByText("プランの有効化に失敗しました: tasks required"),
    ).toBeTruthy();
  });

  it("sends openPlanPanel message when Open Plan Panel is clicked", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    render(<Settings {...defaultProps} activePlan={null} />);
    fireEvent.click(screen.getByText("プランパネルを開く"));
    expect(postMessage).toHaveBeenCalledWith({ type: "openPlanPanel" });
  });

  it("disables cleanup button when nothing is selected", () => {
    render(<Settings {...defaultProps} />);
    fireEvent.click(screen.getByText("詳しく見る"));

    // Uncheck the two defaults (profile, claudeMdRef)
    fireEvent.click(
      screen.getByLabelText("プロフィールデータ（拡張機能ストレージ）"),
    );
    fireEvent.click(screen.getByLabelText("CLAUDE.md 内のメンター参照コード"));

    const cleanupButton = screen.getByText("データ消去");
    expect(cleanupButton.hasAttribute("disabled")).toBe(true);
  });
});
