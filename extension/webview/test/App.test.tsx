import type {
  DashboardData,
  MentorStudioConfig,
  ProviderEntrypointStatus,
} from "@mentor-studio/shared";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import * as vscodeApi from "../src/vscodeApi";

// Mock vscodeApi
vi.mock("../src/vscodeApi", () => {
  let messageHandler: ((msg: unknown) => void) | null = null;
  return {
    postMessage: vi.fn(),
    onMessage: vi.fn((handler: (msg: unknown) => void) => {
      messageHandler = handler;
      return () => {
        messageHandler = null;
      };
    }),
    __simulateMessage: (msg: unknown) => {
      messageHandler?.(msg);
    },
  };
});

const mockApi = vscodeApi as unknown as {
  postMessage: ReturnType<typeof vi.fn>;
  onMessage: ReturnType<typeof vi.fn>;
  __simulateMessage: (msg: unknown) => void;
};

function simulateMessage(msg: unknown) {
  act(() => {
    mockApi.__simulateMessage(msg);
  });
}

const mockConfig: MentorStudioConfig = {
  repositoryName: "test-repo",
};

const noEntrypoints: ProviderEntrypointStatus = {
  claudeEnabled: false,
  claudeMode: null,
  claudeProject: false,
  claudePersonal: false,
  codexEnabled: false,
  hasEntrypoint: false,
};

const mockData: DashboardData = {
  totalQuestions: 5,
  correctRate: 0.8,
  byTopic: [
    { topic: "ts", label: "TypeScript", total: 5, correct: 4, rate: 0.8 },
  ],
  allTopics: [{ key: "ts", label: "TypeScript" }],
  unresolvedGaps: [],
  completedTasks: [{ task: "1", name: "Setup", plan: "phase1.md" }],
  currentTask: "2",
  profileLastUpdated: null,
  topicsWithHistory: [],
  plans: [],
  activePlan: null,
  nextPlan: null,
};

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows loading state initially (default ja)", () => {
    render(<App />);
    expect(screen.getByText("読み込み中...")).toBeTruthy();
  });

  it("shows no-config message when noConfig is received", () => {
    render(<App />);
    simulateMessage({ type: "noConfig" });
    expect(
      screen.getAllByText(/\.mentor\/config\.json/).length,
    ).toBeGreaterThan(0);
  });

  it("shows Actions tab by default (ja)", () => {
    render(<App />);
    expect(screen.getByText("タスクを始める")).toBeTruthy();
  });

  it("switches to Overview tab", () => {
    render(<App />);
    simulateMessage({ type: "update", data: mockData });
    fireEvent.click(screen.getByText("Overview"));
    expect(screen.getByText("回答数")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("switches to Settings tab", () => {
    render(<App />);
    simulateMessage({ type: "config", data: mockConfig, entrypointStatus: noEntrypoints });
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByText("プラン")).toBeTruthy();
  });

  it("shows settings warning badge when no entrypoints are configured", () => {
    render(<App />);
    simulateMessage({ type: "config", data: mockConfig, entrypointStatus: noEntrypoints });
    expect(screen.getAllByText("!").length).toBeGreaterThan(0);
  });

  it("sends ready message on mount", () => {
    render(<App />);
    expect(mockApi.postMessage).toHaveBeenCalledWith({ type: "ready" });
  });

  it("updates data when update message is received", () => {
    render(<App />);
    simulateMessage({ type: "update", data: mockData });
    expect(screen.getByText("✓ データ読み込み済み")).toBeTruthy();
  });

  it("switches to English when config has locale en", () => {
    render(<App />);
    simulateMessage({ type: "config", data: { ...mockConfig, locale: "en" } });
    expect(screen.getByText("Start task")).toBeTruthy();
  });

  it("sends setLocale message when locale is changed", () => {
    render(<App />);
    simulateMessage({ type: "config", data: mockConfig });
    fireEvent.click(screen.getByText("Settings"));
    fireEvent.click(screen.getByLabelText("Language / 言語"));
    expect(mockApi.postMessage).toHaveBeenCalledWith({
      type: "setLocale",
      locale: "en",
    });
  });

  it("enableMentor toggle defaults to true when config has no enableMentor key", () => {
    render(<App />);
    simulateMessage({ type: "config", data: mockConfig });
    fireEvent.click(screen.getByText("Settings"));
    expect(
      (screen.getByLabelText("メンター機能") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("enableMentor toggle reflects false from config", () => {
    render(<App />);
    simulateMessage({
      type: "config",
      data: { ...mockConfig, enableMentor: false },
    });
    fireEvent.click(screen.getByText("Settings"));
    expect(
      (screen.getByLabelText("メンター機能") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("sends setEnableMentor message when enableMentor toggle clicked", () => {
    render(<App />);
    simulateMessage({ type: "config", data: mockConfig });
    fireEvent.click(screen.getByText("Settings"));
    fireEvent.click(screen.getByLabelText("メンター機能"));
    expect(mockApi.postMessage).toHaveBeenCalledWith({
      type: "setEnableMentor",
      value: false,
    });
  });

  it("shows delete error when deleteTopicsResult has failures", () => {
    render(<App />);
    simulateMessage({ type: "config", data: mockConfig });
    simulateMessage({ type: "update", data: mockData });
    fireEvent.click(screen.getByText("Overview"));
    simulateMessage({
      type: "deleteTopicsResult",
      results: [{ key: "ts", ok: false, error: "has_related_data" }],
    });
    expect(
      screen.getByText("紐づく学習データがあるため削除できません"),
    ).toBeTruthy();
  });

  it("shows error only for failed keys in partial failure deleteTopicsResult", () => {
    render(<App />);
    simulateMessage({
      type: "config",
      data: {
        ...mockConfig,
        topics: [
          { key: "ts", label: "TypeScript" },
          { key: "react", label: "React" },
          { key: "css", label: "CSS" },
        ],
      },
    });
    simulateMessage({ type: "update", data: mockData });
    fireEvent.click(screen.getByText("Overview"));
    simulateMessage({
      type: "deleteTopicsResult",
      results: [
        { key: "ts", ok: false, error: "has_related_data" },
        { key: "react", ok: true },
        { key: "css", ok: false, error: "topic_not_found" },
      ],
    });
    // Should show errors for the failed keys
    expect(
      screen.getByText(/紐づく学習データがあるため削除できません/),
    ).toBeTruthy();
    expect(screen.getByText(/トピックが見つかりません/)).toBeTruthy();
  });

  it("shows v3 migration prompt when needsMigration is received (ja)", () => {
    render(<App />);
    simulateMessage({ type: "needsMigration", locale: "ja" });
    expect(screen.getByText("v0.6.6 への移行が必要です")).toBeTruthy();
    expect(screen.getByText("Setup を実行")).toBeTruthy();
  });

  it("shows v3 migration prompt in English when locale is en", () => {
    render(<App />);
    simulateMessage({ type: "needsMigration", locale: "en" });
    expect(screen.getByText("Migration to v0.6.6 required")).toBeTruthy();
    expect(screen.getByText("Run Setup")).toBeTruthy();
  });

  it("sends runSetup message when needsMigration setup button is clicked", () => {
    render(<App />);
    simulateMessage({ type: "needsMigration", locale: "ja" });
    mockApi.postMessage.mockClear();
    fireEvent.click(screen.getByText("Setup を実行"));
    expect(mockApi.postMessage).toHaveBeenCalledWith({ type: "runSetup" });
  });

  it("hides needsMigration UI once a config message arrives", () => {
    render(<App />);
    simulateMessage({ type: "needsMigration", locale: "ja" });
    expect(screen.getByText("v0.6.6 への移行が必要です")).toBeTruthy();
    simulateMessage({ type: "config", data: mockConfig });
    expect(screen.queryByText("v0.6.6 への移行が必要です")).toBeNull();
  });

  it("clears delete error when deleteTopicsResult is all success", () => {
    render(<App />);
    simulateMessage({ type: "config", data: mockConfig });
    simulateMessage({ type: "update", data: mockData });
    fireEvent.click(screen.getByText("Overview"));
    // First send a failure
    simulateMessage({
      type: "deleteTopicsResult",
      results: [{ key: "ts", ok: false, error: "has_related_data" }],
    });
    expect(
      screen.getByText("紐づく学習データがあるため削除できません"),
    ).toBeTruthy();
    // Then send a success
    simulateMessage({
      type: "deleteTopicsResult",
      results: [{ key: "ts", ok: true }],
    });
    expect(
      screen.queryByText("紐づく学習データがあるため削除できません"),
    ).toBeNull();
  });
});
