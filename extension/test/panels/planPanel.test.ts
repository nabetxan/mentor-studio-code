import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanPanel } from "../../src/panels/planPanel";
import { BroadcastBus } from "../../src/services/broadcastBus";
import * as vscodeMock from "../__mocks__/vscode";

// ---------------------------------------------------------------------------
// Mock planWrites / taskWrites so tests don't need a real DB
// ---------------------------------------------------------------------------

vi.mock("../../src/panels/writes/planWrites", () => ({
  createPlan: vi.fn().mockResolvedValue({ id: 1 }),
  updatePlan: vi.fn().mockResolvedValue(undefined),
  deletePlan: vi.fn().mockResolvedValue(undefined),
  removePlan: vi.fn().mockResolvedValue(undefined),
  restorePlan: vi.fn().mockResolvedValue(undefined),
  activatePlan: vi.fn().mockResolvedValue(undefined),
  deactivatePlan: vi.fn().mockResolvedValue(undefined),
  reorderPlans: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/panels/writes/taskWrites", () => ({
  createTask: vi.fn().mockResolvedValue({ id: 1 }),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  reorderTasks: vi.fn().mockResolvedValue(undefined),
  activateTask: vi.fn().mockResolvedValue(undefined),
}));

// Mock snapshot so ready message doesn't try to open a real DB
vi.mock("../../src/panels/snapshot", () => ({
  readSnapshot: vi.fn().mockResolvedValue({ plans: [], tasks: [], topics: [] }),
}));

// ---------------------------------------------------------------------------
// Minimal vscode webview panel mock
// ---------------------------------------------------------------------------

interface FakeWebviewPanel {
  webview: {
    html: string;
    cspSource: string;
    options: unknown;
    asWebviewUri: (u: vscodeMock.MockUri) => vscodeMock.MockUri;
    onDidReceiveMessage: (
      h: (msg: unknown) => void | Promise<void>,
    ) => vscodeMock.Disposable;
    postMessage: (msg: unknown) => Promise<boolean>;
    __triggerMessage: (msg: unknown) => Promise<void>;
  };
  reveal: (column: number) => void;
  onDidDispose: (h: () => void) => vscodeMock.Disposable;
  dispose: () => void;
  __triggerDispose: () => void;
  __posted: unknown[];
  __revealCalls: number[];
}

function makePanel(): FakeWebviewPanel {
  const posted: unknown[] = [];
  const revealCalls: number[] = [];
  let disposeHandler: (() => void) | null = null;
  let msgHandler: ((msg: unknown) => void | Promise<void>) | null = null;

  const panel: FakeWebviewPanel = {
    webview: {
      html: "",
      cspSource: "vscode-resource:",
      options: {},
      asWebviewUri: (u) => u,
      onDidReceiveMessage: (h) => {
        msgHandler = h;
        return new vscodeMock.Disposable();
      },
      postMessage: (msg) => {
        posted.push(msg);
        return Promise.resolve(true);
      },
      __triggerMessage: async (msg: unknown) => {
        if (msgHandler) {
          await msgHandler(msg);
        }
      },
    },
    reveal: (col) => {
      revealCalls.push(col);
    },
    onDidDispose: (h) => {
      disposeHandler = h;
      return new vscodeMock.Disposable();
    },
    dispose: () => {
      disposeHandler?.();
    },
    __triggerDispose: () => {
      disposeHandler?.();
    },
    __posted: posted,
    __revealCalls: revealCalls,
  };

  return panel;
}

// ---------------------------------------------------------------------------
// Extend vscodeMock.window with createWebviewPanel
// ---------------------------------------------------------------------------

type ExtendedWindow = typeof vscodeMock.window & {
  createWebviewPanel: (
    viewType: string,
    title: string,
    column: number,
    options: unknown,
  ) => FakeWebviewPanel;
};

const extWindow = vscodeMock.window as unknown as ExtendedWindow;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_PATHS = { dbPath: "/fake/data.db", wasmPath: "/fake/sql-wasm.wasm" };

function createPanel(): {
  panel: FakeWebviewPanel;
  bus: BroadcastBus;
} {
  const bus = new BroadcastBus();
  const ctx = { extensionUri: vscodeMock.Uri.file("/ext") };
  PlanPanel.createOrShow(
    ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
    bus,
    FAKE_PATHS,
  );
  const panel = panels[panels.length - 1];
  if (!panel) throw new Error("No panel created");
  return { panel, bus };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let panels: FakeWebviewPanel[];

describe("PlanPanel", () => {
  beforeEach(() => {
    panels = [];
    extWindow.createWebviewPanel = vi.fn((_vt, _title, _col, _opts) => {
      const p = makePanel();
      panels.push(p);
      return p;
    });

    // Reset singleton so each test starts fresh
    PlanPanel.current = undefined;
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Original B-1-2 tests
  // -------------------------------------------------------------------------

  it("createOrShow creates a WebviewPanel on first call", () => {
    const bus = new BroadcastBus();
    const ctx = { extensionUri: vscodeMock.Uri.file("/ext") };

    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
    );

    expect(extWindow.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(panels).toHaveLength(1);
  });

  it("createOrShow called twice creates only one panel; second call reveals", () => {
    const bus = new BroadcastBus();
    const ctx = { extensionUri: vscodeMock.Uri.file("/ext") };

    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
    );
    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
    );

    // Only one panel created
    expect(extWindow.createWebviewPanel).toHaveBeenCalledTimes(1);
    // reveal called exactly once (second createOrShow)
    expect(panels[0]?.__revealCalls).toHaveLength(1);
  });

  it("after panel dispose, PlanPanel.current is undefined and new createOrShow creates fresh panel", () => {
    const bus = new BroadcastBus();
    const ctx = { extensionUri: vscodeMock.Uri.file("/ext") };

    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
    );
    expect(PlanPanel.current).toBeDefined();

    // Trigger dispose lifecycle
    panels[0]?.__triggerDispose();

    expect(PlanPanel.current).toBeUndefined();

    // A new call creates a second panel
    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
    );
    expect(extWindow.createWebviewPanel).toHaveBeenCalledTimes(2);
  });

  it("registers a BroadcastBus subscriber that posts to the webview", () => {
    const bus = new BroadcastBus();
    const ctx = { extensionUri: vscodeMock.Uri.file("/ext") };

    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
    );

    const msg = { type: "dbChanged" };
    bus.broadcast(msg);

    expect(panels[0]?.__posted).toContainEqual(msg);
  });

  it("after dispose, broadcasting does NOT post to the disposed panel", () => {
    const bus = new BroadcastBus();
    const ctx = { extensionUri: vscodeMock.Uri.file("/ext") };

    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
    );

    // Dispose
    panels[0]?.__triggerDispose();
    if (panels[0]) panels[0].__posted.length = 0; // clear any messages received before dispose

    // Broadcast after dispose — should NOT reach the old panel
    bus.broadcast({ type: "dbChanged" });
    expect(panels[0]?.__posted).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // B-1-3 new tests: message protocol
  // -------------------------------------------------------------------------

  it("'ready' message triggers initData post", async () => {
    const { panel } = createPanel();

    await panel.webview.__triggerMessage({ type: "ready" });

    expect(panel.__posted).toContainEqual(
      expect.objectContaining({
        type: "initData",
        plans: [],
        tasks: [],
        topics: [],
      }),
    );
  });

  it("'openMarkdownFile' calls vscode.commands.executeCommand with vscode.open", async () => {
    const executeSpy = vi.spyOn(vscodeMock.commands, "executeCommand");
    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "openMarkdownFile",
      filePath: "/workspace/plan.md",
    });

    expect(executeSpy).toHaveBeenCalledWith(
      "vscode.open",
      expect.objectContaining({ fsPath: "/workspace/plan.md" }),
    );
  });

  it("'createPlan' request calls planWrites.createPlan and posts writeOk with same requestId", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "createPlan",
      requestId: "req-abc",
      name: "New Plan",
      filePath: "/workspace/new-plan.md",
    });

    expect(planWritesMod.createPlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { name: "New Plan", filePath: "/workspace/new-plan.md" },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-abc",
    });
  });

  it("write error posts writeError with the requestId and message", async () => {
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");
    vi.mocked(planWritesMod.createPlan).mockRejectedValueOnce(
      new Error("DB locked"),
    );

    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "createPlan",
      requestId: "req-err",
      name: "Bad Plan",
      filePath: "/workspace/bad-plan.md",
    });

    expect(panel.__posted).toContainEqual({
      type: "writeError",
      requestId: "req-err",
      error: "DB locked",
    });
  });

  // NOTE: 'deletePlan' was removed from PanelRequest in Task 3-2 (replaced by removePlan).

  it("'updatePlan' with status=active calls activatePlan", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "updatePlan",
      requestId: "req-act",
      id: 5,
      status: "active",
    });

    expect(planWritesMod.activatePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 5 },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-act",
    });
  });

  it("'updatePlan' with status=queued calls deactivatePlan", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "updatePlan",
      requestId: "req-deact",
      id: 7,
      status: "queued",
    });

    expect(planWritesMod.deactivatePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 7 },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-deact",
    });
  });

  it("'updatePlan' with status=paused throws and posts writeError", async () => {
    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "updatePlan",
      requestId: "req-paused",
      id: 8,
      status: "paused",
    });

    expect(panel.__posted).toContainEqual({
      type: "writeError",
      requestId: "req-paused",
      error: "plan status 'paused' not supported via panel",
    });
  });

  it("'updatePlan' with status=completed throws and posts writeError", async () => {
    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "updatePlan",
      requestId: "req-completed",
      id: 9,
      status: "completed",
    });

    expect(panel.__posted).toContainEqual({
      type: "writeError",
      requestId: "req-completed",
      error: "plan status 'completed' not supported via panel",
    });
  });

  it("'updatePlan' without status calls updatePlan with name/filePath", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "updatePlan",
      requestId: "req-upd",
      id: 3,
      name: "Renamed",
      filePath: "/path/to/plan.md",
    });

    expect(planWritesMod.updatePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 3, name: "Renamed", filePath: "/path/to/plan.md" },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-upd",
    });
  });

  // NOTE: 'updateTask' was removed from PanelRequest in Task 3-2 (Task UI abolished).

  it("'reorderPlans' dispatches to planWrites.reorderPlans and posts writeOk", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "reorderPlans",
      requestId: "req-rp",
      orderedIds: [3, 1, 2],
    });

    expect(planWritesMod.reorderPlans).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { orderedIds: [3, 1, 2] },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-rp",
    });
  });

  // -------------------------------------------------------------------------
  // Task 3-2 new tests: removePlan / restorePlan / pickPlanFile
  // -------------------------------------------------------------------------

  it("'removePlan' dispatches to planWrites.removePlan and posts writeOk", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "removePlan",
      requestId: "req-remove",
      id: 10,
    });

    expect(planWritesMod.removePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 10 },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-remove",
    });
  });

  it("'restorePlan' dispatches to planWrites.restorePlan and posts writeOk", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "restorePlan",
      requestId: "req-restore",
      id: 11,
      toStatus: "backlog",
    });

    expect(planWritesMod.restorePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 11, toStatus: "backlog" },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-restore",
    });
  });

  it("'pickPlanFile' with file selected posts pickPlanFileResult with fsPath", async () => {
    const showOpenDialogSpy = vi
      .spyOn(vscodeMock.window, "showOpenDialog")
      .mockResolvedValueOnce([{ fsPath: "/workspace/myplan.md" }]);

    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "pickPlanFile",
      requestId: "req-pick",
    });

    expect(showOpenDialogSpy).toHaveBeenCalledWith({
      canSelectMany: false,
      filters: { Markdown: ["md"] },
    });
    expect(panel.__posted).toContainEqual({
      type: "pickPlanFileResult",
      requestId: "req-pick",
      filePath: "/workspace/myplan.md",
    });
  });

  it("'pickPlanFile' with dialog cancelled posts pickPlanFileResult with null", async () => {
    vi.spyOn(vscodeMock.window, "showOpenDialog").mockResolvedValueOnce(
      undefined,
    );

    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "pickPlanFile",
      requestId: "req-pick-cancel",
    });

    expect(panel.__posted).toContainEqual({
      type: "pickPlanFileResult",
      requestId: "req-pick-cancel",
      filePath: null,
    });
  });
});
