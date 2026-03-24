import type { DashboardData, MentorStudioConfig } from "@mentor-studio/shared";
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
  topics: [{ key: "ts", label: "TypeScript" }],
};

const mockData: DashboardData = {
  totalQuestions: 5,
  correctRate: 0.8,
  byTopic: [
    { topic: "ts", label: "TypeScript", total: 5, correct: 4, rate: 0.8 },
  ],
  unresolvedGaps: [],
  completedTasks: [{ task: "1", name: "Setup", plan: "phase1.md" }],
  currentTask: "2",
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
    expect(screen.getByText(/\.mentor-studio\.json/)).toBeTruthy();
  });

  it("shows Actions tab by default (ja)", () => {
    render(<App />);
    expect(screen.getByText("メンターアクション")).toBeTruthy();
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
    simulateMessage({ type: "config", data: mockConfig });
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByText("メンターファイル")).toBeTruthy();
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
    expect(screen.getByText("Mentor Actions")).toBeTruthy();
  });

  it("sends setLocale message when locale is changed", () => {
    render(<App />);
    simulateMessage({ type: "config", data: mockConfig });
    fireEvent.click(screen.getByText("Settings"));
    const toggle = screen.getByRole("checkbox");
    fireEvent.click(toggle);
    expect(mockApi.postMessage).toHaveBeenCalledWith({
      type: "setLocale",
      locale: "en",
    });
  });
});
