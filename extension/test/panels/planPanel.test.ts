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
  changeStatus: vi.fn().mockResolvedValue(undefined),
  setAsActivePlan: vi.fn().mockResolvedValue({
    id: 1,
    created: true,
    restored: false,
    activated: true,
    demoted: false,
  }),
  addPlanToBacklog: vi.fn().mockResolvedValue({
    id: 1,
    created: true,
    restored: false,
    activated: false,
    demoted: false,
  }),
}));

vi.mock("../../src/panels/readConfigLocale", () => ({
  readConfigLocale: vi.fn().mockResolvedValue("en"),
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

const FAKE_PATHS = {
  dbPath: "/fake/data.db",
  wasmPath: "/fake/sql-wasm.wasm",
  workspaceRoot: "/fake/workspace",
};

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

    (
      vscodeMock.workspace as unknown as {
        workspaceFolders: { uri: vscodeMock.MockUri }[] | undefined;
      }
    ).workspaceFolders = [{ uri: vscodeMock.Uri.file("/workspace") }];
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

  it("'openMarkdownFile' opens an absolute path via showTextDocument", async () => {
    const showSpy = vi.spyOn(vscodeMock.window, "showTextDocument");
    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "openMarkdownFile",
      filePath: "/workspace/plan.md",
    });

    expect(showSpy).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/workspace/plan.md" }),
      expect.objectContaining({ preview: true }),
    );
  });

  it("'openMarkdownFile' resolves a relative path against the workspace root", async () => {
    const showSpy = vi.spyOn(vscodeMock.window, "showTextDocument");
    const wsMutable = vscodeMock.workspace as unknown as {
      workspaceFolders: { uri: vscodeMock.MockUri }[] | undefined;
    };
    wsMutable.workspaceFolders = [{ uri: vscodeMock.Uri.file("/repo") }];
    try {
      const { panel } = createPanel();
      await panel.webview.__triggerMessage({
        type: "openMarkdownFile",
        filePath: "docs/plan.md",
      });

      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: "/repo/docs/plan.md" }),
        expect.objectContaining({ preview: true }),
      );
    } finally {
      wsMutable.workspaceFolders = undefined;
    }
  });

  it("'openMarkdownFile' shows an error when the file cannot be opened", async () => {
    const errSpy = vi.spyOn(vscodeMock.window, "showErrorMessage");
    vi.spyOn(vscodeMock.window, "showTextDocument").mockRejectedValueOnce(
      new Error("file not found"),
    );
    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "openMarkdownFile",
      filePath: "/missing/plan.md",
    });

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to open /missing/plan.md"),
    );
  });

  it("'createPlan' request calls planWrites.addPlanToBacklog and posts writeOk with same requestId", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "createPlan",
      requestId: "req-abc",
      name: "New Plan",
      filePath: "/workspace/new-plan.md",
    });

    expect(planWritesMod.addPlanToBacklog).toHaveBeenCalledWith(
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
    vi.mocked(planWritesMod.addPlanToBacklog).mockRejectedValueOnce(
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
  // NOTE: 'updatePlan' with `status` and the 'restorePlan' request were removed from
  // the panel protocol — status transitions are handled exclusively by 'setPlanStatus'.

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
      filePath: "myplan.md",
    });
  });

  it("'pickPlanFile' with file outside workspace posts pickPlanFileResult with null and shows error", async () => {
    vi.spyOn(vscodeMock.window, "showOpenDialog").mockResolvedValueOnce([
      { fsPath: "/elsewhere/myplan.md" } as unknown as vscodeMock.MockUri,
    ]);
    const errSpy = vi.spyOn(vscodeMock.window, "showErrorMessage");

    const { panel } = createPanel();

    await panel.webview.__triggerMessage({
      type: "pickPlanFile",
      requestId: "req-pick-outside",
    });

    expect(errSpy).toHaveBeenCalledOnce();
    expect(panel.__posted).toContainEqual({
      type: "pickPlanFileResult",
      requestId: "req-pick-outside",
      filePath: null,
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

  // -------------------------------------------------------------------------
  // setPlanStatus handler tests
  // -------------------------------------------------------------------------

  it("setPlanStatus to 'queued' when source is non-active calls changeStatus", async () => {
    const { panel } = createPanel();
    // Explicit snapshot — plan 3 exists with status 'backlog' (non-active).
    const snapshotMod = await import("../../src/panels/snapshot.js");
    vi.mocked(snapshotMod.readSnapshot).mockResolvedValue({
      plans: [
        { id: 3, name: "P3", filePath: null, status: "backlog", sortOrder: 1 },
      ],
      tasks: [],
      topics: [],
    });
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-cs-1",
      id: 3,
      toStatus: "queued",
    });

    expect(planWritesMod.changeStatus).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 3, toStatus: "queued" },
      FAKE_PATHS.wasmPath,
    );
    expect(planWritesMod.deactivatePlan).not.toHaveBeenCalled();
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-cs-1",
    });
  });

  it("setPlanStatus to 'active' without conflict calls activatePlan", async () => {
    const { panel } = createPanel();
    const snapshotMod = await import("../../src/panels/snapshot.js");
    vi.mocked(snapshotMod.readSnapshot).mockResolvedValue({
      plans: [
        { id: 3, name: "P3", filePath: null, status: "queued", sortOrder: 1 },
      ],
      tasks: [],
      topics: [],
    });
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-act-1",
      id: 3,
      toStatus: "active",
    });

    expect(planWritesMod.activatePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 3 },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-act-1",
    });
  });

  it("setPlanStatus to 'active' with conflict + Replace: activates new plan", async () => {
    const { panel } = createPanel();
    const snapshotMod = await import("../../src/panels/snapshot.js");
    vi.mocked(snapshotMod.readSnapshot).mockResolvedValue({
      plans: [
        {
          id: 1,
          name: "Plan A",
          filePath: null,
          status: "active",
          sortOrder: 1,
        },
        {
          id: 3,
          name: "Plan B",
          filePath: null,
          status: "queued",
          sortOrder: 2,
        },
      ],
      tasks: [],
      topics: [],
    });
    vi.spyOn(vscodeMock.window, "showInformationMessage").mockResolvedValueOnce(
      "Activate",
    );
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-conflict-1",
      id: 3,
      toStatus: "active",
    });

    expect(vscodeMock.window.showInformationMessage).toHaveBeenCalled();
    expect(planWritesMod.activatePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 3 },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-conflict-1",
    });
  });

  it("setPlanStatus to 'active' with conflict + Cancel: no-op, returns writeOk", async () => {
    const { panel } = createPanel();
    const snapshotMod = await import("../../src/panels/snapshot.js");
    vi.mocked(snapshotMod.readSnapshot).mockResolvedValue({
      plans: [
        {
          id: 1,
          name: "Plan A",
          filePath: null,
          status: "active",
          sortOrder: 1,
        },
        {
          id: 3,
          name: "Plan B",
          filePath: null,
          status: "queued",
          sortOrder: 2,
        },
      ],
      tasks: [],
      topics: [],
    });
    vi.spyOn(vscodeMock.window, "showInformationMessage").mockResolvedValueOnce(
      undefined,
    );
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-cancel-1",
      id: 3,
      toStatus: "active",
    });

    expect(planWritesMod.activatePlan).not.toHaveBeenCalled();
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-cancel-1",
    });
  });

  it("setPlanStatus to 'removed' calls removePlan (non-active source)", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-rm-1",
      id: 5,
      toStatus: "removed",
    });

    expect(planWritesMod.removePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 5 },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-rm-1",
    });
  });

  it("setPlanStatus to 'removed' from active: deactivates first, then removes", async () => {
    const { panel } = createPanel();
    const snapshotMod = await import("../../src/panels/snapshot.js");
    vi.mocked(snapshotMod.readSnapshot).mockResolvedValue({
      plans: [
        {
          id: 1,
          name: "Plan A",
          filePath: null,
          status: "active",
          sortOrder: 1,
        },
      ],
      tasks: [],
      topics: [],
    });
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-rm-active",
      id: 1,
      toStatus: "removed",
    });

    expect(planWritesMod.deactivatePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 1 },
      FAKE_PATHS.wasmPath,
    );
    expect(planWritesMod.removePlan).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 1 },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-rm-active",
    });
  });

  it("setPlanStatus to 'paused' from active is a single-tx changeStatus", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-pause-active",
      id: 1,
      toStatus: "paused",
    });

    // Single transaction: changeStatus handles active → paused directly — no
    // intermediate deactivatePlan call, so a partial failure can't leave the
    // plan stuck in 'queued'.
    expect(planWritesMod.deactivatePlan).not.toHaveBeenCalled();
    expect(planWritesMod.changeStatus).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 1, toStatus: "paused" },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-pause-active",
    });
  });

  it("setPlanStatus to 'queued' from active is a single-tx changeStatus", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-deact-active",
      id: 1,
      toStatus: "queued",
    });

    expect(planWritesMod.deactivatePlan).not.toHaveBeenCalled();
    expect(planWritesMod.changeStatus).toHaveBeenCalledWith(
      FAKE_PATHS.dbPath,
      { id: 1, toStatus: "queued" },
      FAKE_PATHS.wasmPath,
    );
    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-deact-active",
    });
  });

  it("in-flight setPlanStatus for same id returns writeError busy", async () => {
    const { panel } = createPanel();
    const planWritesMod = await import("../../src/panels/writes/planWrites.js");
    let resolveFirst!: () => void;
    vi.mocked(planWritesMod.changeStatus).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const firstPromise = panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-flight-1",
      id: 10,
      toStatus: "paused",
    });

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-flight-2",
      id: 10,
      toStatus: "completed",
    });

    expect(panel.__posted).toContainEqual({
      type: "writeError",
      requestId: "req-flight-2",
      error: "busy",
    });

    resolveFirst();
    await firstPromise;

    expect(panel.__posted).toContainEqual({
      type: "writeOk",
      requestId: "req-flight-1",
    });
  });

  it("initData includes locale field", async () => {
    const { panel } = createPanel();
    await panel.webview.__triggerMessage({ type: "ready" });

    const initMsg = panel.__posted.find(
      (m) => (m as Record<string, unknown>).type === "initData",
    ) as Record<string, unknown> | undefined;
    expect(initMsg).toBeDefined();
    expect(initMsg?.locale).toBe("en");
  });

  it("conflict dialog message uses Japanese when locale is ja", async () => {
    // Force the cached locale by seeding the readConfigLocale mock before the
    // panel reads it via 'ready'.
    const localeMod = await import("../../src/panels/readConfigLocale.js");
    vi.mocked(localeMod.readConfigLocale).mockResolvedValue("ja");

    const { panel } = createPanel();
    // 'ready' populates the cached locale used by the conflict dialog.
    await panel.webview.__triggerMessage({ type: "ready" });

    const snapshotMod = await import("../../src/panels/snapshot.js");
    vi.mocked(snapshotMod.readSnapshot).mockResolvedValue({
      plans: [
        {
          id: 1,
          name: "Plan A",
          filePath: null,
          status: "active",
          sortOrder: 1,
        },
        {
          id: 2,
          name: "Plan B",
          filePath: null,
          status: "queued",
          sortOrder: 2,
        },
      ],
      tasks: [],
      topics: [],
    });
    const infoSpy = vi
      .spyOn(vscodeMock.window, "showInformationMessage")
      .mockResolvedValueOnce(undefined);

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-ja-conflict",
      id: 2,
      toStatus: "active",
    });

    expect(infoSpy).toHaveBeenCalled();
    const [message] = infoSpy.mock.calls[0];
    expect(message).toContain("アクティブプラン");
    expect(message).toContain("Plan A");
    expect(message).toContain("Plan B");

    // Reset for sibling tests.
    vi.mocked(localeMod.readConfigLocale).mockResolvedValue("en");
  });

  it("onAfterWrite fires after a successful write request", async () => {
    const bus = new BroadcastBus();
    const onAfterWrite = vi.fn().mockResolvedValue(undefined);
    const ctx = { extensionUri: vscodeMock.Uri.file("/ext") };
    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
      onAfterWrite,
    );
    const panel = panels[panels.length - 1];

    await panel.webview.__triggerMessage({
      type: "createPlan",
      requestId: "req-after-1",
      name: "P",
      filePath: "/p.md",
    });
    // Let the finally{} microtask settle.
    await Promise.resolve();

    expect(onAfterWrite).toHaveBeenCalledTimes(1);
  });

  it("onAfterWrite fires after a setPlanStatus request too", async () => {
    const bus = new BroadcastBus();
    const onAfterWrite = vi.fn().mockResolvedValue(undefined);
    const ctx = { extensionUri: vscodeMock.Uri.file("/ext") };
    PlanPanel.createOrShow(
      ctx as unknown as Parameters<typeof PlanPanel.createOrShow>[0],
      bus,
      FAKE_PATHS,
      onAfterWrite,
    );
    const panel = panels[panels.length - 1];

    await panel.webview.__triggerMessage({
      type: "setPlanStatus",
      requestId: "req-after-2",
      id: 1,
      toStatus: "paused",
    });
    // The finally-hook that runs onAfterWrite is attached to the in-flight
    // promise; yield twice so its microtasks complete.
    await Promise.resolve();
    await Promise.resolve();

    expect(onAfterWrite).toHaveBeenCalledTimes(1);
  });
});
