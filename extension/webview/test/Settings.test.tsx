import type {
  MentorStudioConfig,
  PlanDto,
  ProviderEntrypointStatus,
} from "@mentor-studio/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Settings } from "../src/components/Settings";

vi.mock("../src/vscodeApi", () => ({
  postMessage: vi.fn(),
}));

const defaultProps = {
  config: null as MentorStudioConfig | null,
  entrypointStatus: {
    claudeEnabled: false,
    claudeMode: null,
    claudeProject: false,
    claudePersonal: false,
    codexEnabled: false,
    hasEntrypoint: false,
  } satisfies ProviderEntrypointStatus,
  locale: "ja" as const,
  onLocaleChange: () => {},
  profileLastUpdated: null as string | null,
  activePlan: null as PlanDto | null,
  nextPlan: null as PlanDto | null,
  planActionError: null as string | null,
};

describe("Settings", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows unset state when config is null", () => {
    render(<Settings {...defaultProps} />);
    // Spec and active plan both show the "⚠ 未設定" warning
    const warnings = screen.getAllByText("⚠ 未設定");
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    // Active-plan row uses the unified "Active:" label in both unset and set states.
    expect(screen.getAllByText("Active:").length).toBeGreaterThan(0);
  });

  it("shows unset state when mentorFiles are not set", () => {
    const config: MentorStudioConfig = {
      repositoryName: "test",
    };
    render(<Settings {...defaultProps} config={config} />);
    const warnings = screen.getAllByText("⚠ 未設定");
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("renders provider settings and missing-entrypoint warning", () => {
    render(<Settings {...defaultProps} />);
    expect(screen.getByText("Mentor機能を利用するAIツール")).toBeTruthy();
    expect(
      screen.getByText(
        "Mentor機能を利用するには、Claude Code または Codex を選択してください",
      ),
    ).toBeTruthy();
  });

  it("shows Claude scope radios only when Claude Code is enabled", () => {
    render(
      <Settings
        {...defaultProps}
        entrypointStatus={{
          claudeEnabled: true,
          claudeMode: "personal",
          claudeProject: false,
          claudePersonal: true,
          codexEnabled: false,
          hasEntrypoint: true,
        }}
      />,
    );
    expect(screen.getByLabelText("Claude Code")).toBeTruthy();
    expect(screen.getByLabelText("Project")).toBeTruthy();
    expect(screen.getByLabelText("Personal")).toBeTruthy();
    expect((screen.getByLabelText("Personal") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("sends provider toggle messages", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    render(<Settings {...defaultProps} locale="en" />);

    fireEvent.click(screen.getByLabelText("Claude Code"));
    fireEvent.click(screen.getByLabelText("Codex"));

    expect(postMessage).toHaveBeenCalledWith({
      type: "setClaudeCodeEnabled",
      value: true,
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: "setCodexEnabled",
      value: true,
    });
  });

  it("sends Claude scope changes", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    render(
      <Settings
        {...defaultProps}
        locale="en"
        entrypointStatus={{
          claudeEnabled: true,
          claudeMode: "project",
          claudeProject: true,
          claudePersonal: false,
          codexEnabled: false,
          hasEntrypoint: true,
        }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Personal"));

    expect(postMessage).toHaveBeenCalledWith({
      type: "setClaudeCodeScope",
      value: "personal",
    });
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

  it("renders Active Plan warning when activePlan is null", () => {
    render(<Settings {...defaultProps} activePlan={null} />);
    expect(screen.getAllByText("Active:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("⚠ 未設定").length).toBeGreaterThan(0);
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
    const checkbox = screen.getByLabelText("Language / 言語");
    fireEvent.click(checkbox);
    expect(onLocaleChange).toHaveBeenCalledWith("en");
  });

  it("renders labels in English", () => {
    render(<Settings {...defaultProps} locale="en" />);
    const warnings = screen.getAllByText("⚠ Not set");
    expect(warnings).toHaveLength(2);
    expect(screen.getAllByText("Active:").length).toBeGreaterThan(0);
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

    // Step 1 and Step 2 headings should be visible
    expect(screen.getByText("Step 1. データを消去する")).toBeTruthy();
    expect(screen.getByText("Step 2. 拡張機能をアンインストールする")).toBeTruthy();

    // Click cleanup button (profile and claudeMdRef are checked by default)
    fireEvent.click(screen.getByText("データ消去"));

    expect(postMessage).toHaveBeenCalledWith({
      type: "cleanupMentor",
      options: {
        mentorFolder: false,
        profile: true,
        claudeMdRef: true,
        wipeExternalDb: false,
      },
    });
  });

  it("sends openExtensionsView message when Step 2 button is clicked", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    render(<Settings {...defaultProps} />);

    fireEvent.click(screen.getByText("詳しく見る"));
    fireEvent.click(
      screen.getByRole("button", { name: "拡張機能ビューを開く" }),
    );

    expect(postMessage).toHaveBeenCalledWith({ type: "openExtensionsView" });
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

  it("renders Open Panel button in Plan section header", () => {
    render(<Settings {...defaultProps} />);
    expect(screen.getByRole("button", { name: "パネルを開く" })).toBeTruthy();
  });

  it("sends openPlanPanel message when Open Panel button is clicked", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    render(<Settings {...defaultProps} activePlan={null} />);
    fireEvent.click(screen.getByRole("button", { name: "パネルを開く" }));
    expect(postMessage).toHaveBeenCalledWith({ type: "openPlanPanel" });
  });

  it("renders only Active row when active plan exists and no next plan", () => {
    const activePlan: PlanDto = {
      id: 10,
      name: "Phase 1",
      filePath: "docs/a.md",
      status: "active",
      sortOrder: 0,
    };
    render(<Settings {...defaultProps} activePlan={activePlan} />);
    expect(screen.getByText("Active:")).toBeTruthy();
    expect(screen.queryByText("Next:")).toBeNull();
  });

  it("renders both Active and Next rows when both exist, without Activate button", () => {
    const activePlan: PlanDto = {
      id: 11,
      name: "Phase 1",
      filePath: "docs/a.md",
      status: "active",
      sortOrder: 0,
    };
    const nextPlan: PlanDto = {
      id: 12,
      name: "Phase 2",
      filePath: "docs/b.md",
      status: "queued",
      sortOrder: 1,
    };
    render(
      <Settings
        {...defaultProps}
        activePlan={activePlan}
        nextPlan={nextPlan}
      />,
    );
    expect(screen.getByText("Active:")).toBeTruthy();
    expect(screen.getByText("Next:")).toBeTruthy();
    expect(screen.getByText("docs/a.md")).toBeTruthy();
    expect(screen.getByText("docs/b.md")).toBeTruthy();
    expect(screen.queryByText("有効化")).toBeNull();
  });

  it("shows warning UI plus Next row with Activate button when no active plan but next plan exists", async () => {
    const { postMessage } = await import("../src/vscodeApi");
    (postMessage as ReturnType<typeof vi.fn>).mockClear();
    const nextPlan: PlanDto = {
      id: 13,
      name: "Phase 2",
      filePath: "docs/b.md",
      status: "queued",
      sortOrder: 1,
    };
    render(
      <Settings {...defaultProps} activePlan={null} nextPlan={nextPlan} />,
    );
    expect(screen.getAllByText("Active:").length).toBeGreaterThan(0);
    expect(screen.getByText("Next:")).toBeTruthy();
    expect(screen.getByText("docs/b.md")).toBeTruthy();
    fireEvent.click(screen.getByText("有効化"));
    expect(postMessage).toHaveBeenCalledWith({ type: "activatePlan", id: 13 });
  });

  it("disables cleanup button when nothing is selected", () => {
    render(<Settings {...defaultProps} />);
    fireEvent.click(screen.getByText("詳しく見る"));

    // Uncheck the two defaults (profile, claudeMdRef)
    fireEvent.click(
      screen.getByLabelText("プロフィールデータ（拡張機能ストレージ）"),
    );
    fireEvent.click(
      screen.getByLabelText("AI ツールのエントリポイント内のメンター参照"),
    );

    const cleanupButton = screen.getByText("データ消去");
    expect(cleanupButton.hasAttribute("disabled")).toBe(true);
  });
});
