import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "../../src/views/sidebarProvider";
import * as vscodeMock from "../__mocks__/vscode";

const MENTOR_REF = "@.mentor/rules/MENTOR_RULES.md";
const AGENTS_BLOCK = `<!-- msc:agents:start -->\nFollow ${MENTOR_REF}\n<!-- msc:agents:end -->\n`;

// Convenience: full set of no-op plan handlers
function noopPlanHandlers() {
  return {
    activatePlan: () => Promise.resolve(),
    deactivatePlan: () => Promise.resolve(),
    pauseActivePlan: () => Promise.resolve(),
    changeActivePlanFile: () => Promise.resolve(),
    createAndActivatePlan: () => Promise.resolve(),
  };
}

type MessageHandler = (msg: unknown) => void | Promise<void>;

interface FakeWebviewView {
  webview: {
    options: unknown;
    html: string;
    cspSource: string;
    onDidReceiveMessage: (h: MessageHandler) => vscodeMock.Disposable;
    postMessage: (msg: unknown) => Promise<boolean>;
    asWebviewUri: (u: vscodeMock.MockUri) => vscodeMock.MockUri;
  };
  onDidDispose: (h: () => void) => vscodeMock.Disposable;
  __trigger: (msg: unknown) => Promise<void>;
  __posted: unknown[];
}

function makeView(): FakeWebviewView {
  const posted: unknown[] = [];
  let handler: MessageHandler | null = null;
  return {
    webview: {
      options: undefined,
      html: "",
      cspSource: "vscode-resource:",
      onDidReceiveMessage: (h) => {
        handler = h;
        return new vscodeMock.Disposable();
      },
      postMessage: (msg) => {
        posted.push(msg);
        return Promise.resolve(true);
      },
      asWebviewUri: (u) => u,
    },
    onDidDispose: () => new vscodeMock.Disposable(),
    __trigger: async (msg) => {
      if (handler) await handler(msg);
    },
    __posted: posted,
  };
}

describe("SidebarProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (
      vscodeMock.workspace as unknown as {
        workspaceFolders: { uri: vscodeMock.MockUri }[] | undefined;
      }
    ).workspaceFolders = [{ uri: vscodeMock.Uri.file("/workspace") }];
  });

  it("getSubscriber() forwards messages to the webview", () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const sub = provider.getSubscriber();
    sub.postMessage({ type: "dbChanged" });
    expect(view.__posted).toContainEqual({ type: "dbChanged" });
  });

  it("getSubscriber() is a no-op when view is not yet resolved", () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const sub = provider.getSubscriber();
    expect(() => sub.postMessage({ type: "dbChanged" })).not.toThrow();
  });

  it("sendConfig includes derived entrypoint file status", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    vi.spyOn(vscodeMock.workspace.fs, "readFile").mockImplementation(
      async (uri) => {
        if (uri.fsPath === "/workspace/AGENTS.md") {
          return Uint8Array.from(
            Buffer.from(
              "<!-- msc:agents:start -->\n@.mentor/rules/MENTOR_RULES.md\n<!-- msc:agents:end -->\n",
            ),
          );
        }
        return new Uint8Array();
      },
    );

    await provider.sendConfig({ repositoryName: "repo", enableMentor: true });

    expect(view.__posted).toContainEqual(
      expect.objectContaining({
        type: "config",
        entrypointStatus: expect.objectContaining({
          agentsMdEnabled: true,
          hasEntrypointFile: true,
        }),
      }),
    );
  });

  it("prompts in English before enabling CLAUDE.md from Settings and cancels cleanly", async () => {
    const files = new Map<string, string>();
    vi.spyOn(vscodeMock.workspace.fs, "readFile").mockImplementation(async (uri) =>
      Uint8Array.from(Buffer.from(files.get(uri.fsPath) ?? "")),
    );
    const writeFile = vi
      .spyOn(vscodeMock.workspace.fs, "writeFile")
      .mockImplementation(async (uri, content) => {
        files.set(uri.fsPath, Buffer.from(content).toString());
      });
    vi.spyOn(vscodeMock.workspace.fs, "createDirectory").mockResolvedValue();

    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    await provider.sendConfig({ repositoryName: "repo", locale: "en" });
    writeFile.mockClear();

    const confirm = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue(undefined);

    await view.__trigger({ type: "setClaudeMdEnabled", value: true });

    expect(confirm).toHaveBeenCalledWith(
      "This will update `CLAUDE.md` and add the Mentor reference. Continue?",
      { modal: true },
      "Continue",
    );
    expect(writeFile).not.toHaveBeenCalled();
    expect(files.get("/workspace/CLAUDE.md")).toBeUndefined();
    expect(view.__posted.at(-1)).toEqual(
      expect.objectContaining({
        type: "config",
        entrypointStatus: expect.objectContaining({
          claudeMdEnabled: false,
        }),
      }),
    );
  });

  it("prompts before changing CLAUDE.md scope from Settings", async () => {
    const files = new Map<string, string>([
      ["/workspace/CLAUDE.md", `${MENTOR_REF}\n`],
    ]);
    vi.spyOn(vscodeMock.workspace.fs, "readFile").mockImplementation(async (uri) =>
      Uint8Array.from(Buffer.from(files.get(uri.fsPath) ?? "")),
    );
    const writeFile = vi
      .spyOn(vscodeMock.workspace.fs, "writeFile")
      .mockImplementation(async (uri, content) => {
        files.set(uri.fsPath, Buffer.from(content).toString());
      });
    vi.spyOn(vscodeMock.workspace.fs, "createDirectory").mockResolvedValue();

    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    await provider.sendConfig({ repositoryName: "repo", locale: "en" });
    writeFile.mockClear();

    const confirm = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue(undefined);

    await view.__trigger({ type: "setClaudeMdScope", value: "personal" });

    expect(confirm).toHaveBeenCalledWith(
      "This will move the Mentor reference from the project `CLAUDE.md` to your personal `CLAUDE.md`. Continue?",
      { modal: true },
      "Continue",
    );
    expect(writeFile).not.toHaveBeenCalled();
    expect(files.get("/workspace/CLAUDE.md")).toBe(`${MENTOR_REF}\n`);
  });

  it("uses a generic CLAUDE.md prompt when no existing scope is set", async () => {
    const files = new Map<string, string>();
    vi.spyOn(vscodeMock.workspace.fs, "readFile").mockImplementation(async (uri) =>
      Uint8Array.from(Buffer.from(files.get(uri.fsPath) ?? "")),
    );
    const writeFile = vi
      .spyOn(vscodeMock.workspace.fs, "writeFile")
      .mockImplementation(async (uri, content) => {
        files.set(uri.fsPath, Buffer.from(content).toString());
      });
    vi.spyOn(vscodeMock.workspace.fs, "createDirectory").mockResolvedValue();

    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    await provider.sendConfig({ repositoryName: "repo", locale: "en" });
    writeFile.mockClear();

    const confirm = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue(undefined);

    await view.__trigger({ type: "setClaudeMdScope", value: "personal" });

    expect(confirm).toHaveBeenCalledWith(
      "This will update the Mentor reference in `CLAUDE.md`. Continue?",
      { modal: true },
      "Continue",
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("prompts in Japanese before enabling AGENTS.md from Settings and updates after approval", async () => {
    const files = new Map<string, string>();
    vi.spyOn(vscodeMock.workspace.fs, "readFile").mockImplementation(async (uri) =>
      Uint8Array.from(Buffer.from(files.get(uri.fsPath) ?? "")),
    );
    vi.spyOn(vscodeMock.workspace.fs, "writeFile").mockImplementation(
      async (uri, content) => {
        files.set(uri.fsPath, Buffer.from(content).toString());
      },
    );
    vi.spyOn(vscodeMock.workspace.fs, "createDirectory").mockResolvedValue();

    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    await provider.sendConfig({ repositoryName: "repo", locale: "ja" });

    const confirm = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue("続行する");

    await view.__trigger({ type: "setAgentsMdEnabled", value: true });

    expect(confirm).toHaveBeenCalledWith(
      "`AGENTS.md` を更新して Mentor 参照を追加します。続行しますか？",
      { modal: true },
      "続行する",
    );
    expect(files.get("/workspace/AGENTS.md")).toBe(AGENTS_BLOCK);
  });

  it("mergeTopic message calls the registered handler", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const mergeTopic = vi.fn(() => Promise.resolve());
    provider.setTopicHandlers({
      mergeTopic,
      updateTopicLabel: () => Promise.resolve(),
      addTopic: () => Promise.resolve({ ok: true, key: "t_1" }),
      deleteTopics: () => Promise.resolve([]),
    });
    await view.__trigger({
      type: "mergeTopic",
      fromKey: "t_1",
      toKey: "t_2",
    });
    expect(mergeTopic).toHaveBeenCalledWith("t_1", "t_2");
  });

  it("mergeTopic handler throw → showErrorMessage", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const showError = vi
      .spyOn(vscodeMock.window, "showErrorMessage")
      .mockResolvedValue(undefined);
    provider.setTopicHandlers({
      mergeTopic: () => Promise.reject(new Error("boom")),
      updateTopicLabel: () => Promise.resolve(),
      addTopic: () => Promise.resolve({ ok: true, key: "t_1" }),
      deleteTopics: () => Promise.resolve([]),
    });
    await view.__trigger({
      type: "mergeTopic",
      fromKey: "t_1",
      toKey: "t_2",
    });
    expect(showError).toHaveBeenCalledTimes(1);
  });

  it("deleteTopics posts deleteTopicsResult with handler results", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    provider.setTopicHandlers({
      mergeTopic: () => Promise.resolve(),
      updateTopicLabel: () => Promise.resolve(),
      addTopic: () => Promise.resolve({ ok: true, key: "t_1" }),
      deleteTopics: (keys) =>
        Promise.resolve(keys.map((key) => ({ key, ok: true }))),
    });
    await view.__trigger({ type: "deleteTopics", keys: ["t_1", "t_2"] });
    expect(view.__posted).toContainEqual({
      type: "deleteTopicsResult",
      results: [
        { key: "t_1", ok: true },
        { key: "t_2", ok: true },
      ],
    });
  });

  it("activatePlan calls handler and posts success result", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const activatePlan = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), activatePlan });
    await view.__trigger({ type: "activatePlan", id: 5 });
    expect(activatePlan).toHaveBeenCalledWith(5);
    expect(view.__posted).toContainEqual({
      type: "activatePlanResult",
      id: 5,
      ok: true,
    });
  });

  it("activatePlan handler throw → posts failure with error message", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    provider.setPlanHandlers({
      ...noopPlanHandlers(),
      activatePlan: () => Promise.reject(new Error("no open tasks")),
    });
    await view.__trigger({ type: "activatePlan", id: 9 });
    expect(view.__posted).toContainEqual({
      type: "activatePlanResult",
      id: 9,
      ok: false,
      error: "no open tasks",
    });
  });

  it("deactivatePlan calls handler and posts success result", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const deactivatePlan = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), deactivatePlan });
    await view.__trigger({ type: "deactivatePlan", id: 2 });
    expect(deactivatePlan).toHaveBeenCalledWith(2);
    expect(view.__posted).toContainEqual({
      type: "deactivatePlanResult",
      id: 2,
      ok: true,
    });
  });

  it("activatePlan without handler posts no_handler error", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    await view.__trigger({ type: "activatePlan", id: 1 });
    expect(view.__posted).toContainEqual({
      type: "activatePlanResult",
      id: 1,
      ok: false,
      error: "no_handler",
    });
  });

  it("openPlanPanel message executes mentor-studio.openPlanPanel command", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const executeCommand = vi
      .spyOn(vscodeMock.commands, "executeCommand")
      .mockResolvedValue(undefined);
    await view.__trigger({ type: "openPlanPanel" });
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith("mentor-studio.openPlanPanel");
  });

  it("deleteTopics handler throw → posts per-key error results", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    provider.setTopicHandlers({
      mergeTopic: () => Promise.resolve(),
      updateTopicLabel: () => Promise.resolve(),
      addTopic: () => Promise.resolve({ ok: true, key: "t_1" }),
      deleteTopics: () => Promise.reject(new Error("boom")),
    });
    await view.__trigger({ type: "deleteTopics", keys: ["t_1"] });
    expect(view.__posted).toContainEqual({
      type: "deleteTopicsResult",
      results: [{ key: "t_1", ok: false, error: "delete_failed" }],
    });
  });

  it("pauseActivePlan calls handler and posts success result", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const pauseActivePlan = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), pauseActivePlan });
    await view.__trigger({ type: "pauseActivePlan", id: 3 });
    expect(pauseActivePlan).toHaveBeenCalledWith(3);
    expect(view.__posted).toContainEqual({
      type: "pauseActivePlanResult",
      id: 3,
      ok: true,
    });
  });

  it("pauseActivePlan handler throw → posts failure with error message", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    provider.setPlanHandlers({
      ...noopPlanHandlers(),
      pauseActivePlan: () => Promise.reject(new Error("pause_failed")),
    });
    await view.__trigger({ type: "pauseActivePlan", id: 7 });
    expect(view.__posted).toContainEqual({
      type: "pauseActivePlanResult",
      id: 7,
      ok: false,
      error: "pause_failed",
    });
  });

  it("changeActivePlanFile dialog cancelled → handler NOT called, ok:true result posted", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const changeActivePlanFile = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), changeActivePlanFile });
    vi.spyOn(vscodeMock.window, "showOpenDialog").mockResolvedValue(undefined);
    await view.__trigger({ type: "changeActivePlanFile" });
    expect(changeActivePlanFile).not.toHaveBeenCalled();
    expect(view.__posted).toContainEqual({
      type: "changeActivePlanFileResult",
      ok: true,
    });
  });

  it("changeActivePlanFile dialog picks file → handler called with relPath, success posted", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const changeActivePlanFile = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), changeActivePlanFile });
    const fakeUri = vscodeMock.Uri.file("/workspace/plans/chapter1.md");
    vi.spyOn(vscodeMock.window, "showOpenDialog").mockResolvedValue([fakeUri]);
    await view.__trigger({ type: "changeActivePlanFile" });
    expect(changeActivePlanFile).toHaveBeenCalledOnce();
    expect(changeActivePlanFile).toHaveBeenCalledWith("plans/chapter1.md");
    expect(view.__posted).toContainEqual({
      type: "changeActivePlanFileResult",
      ok: true,
    });
  });

  it("selectFile with field:plan dialog cancelled → no handler call, no crash", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const createAndActivatePlan = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), createAndActivatePlan });
    vi.spyOn(vscodeMock.window, "showOpenDialog").mockResolvedValue(undefined);
    await expect(
      view.__trigger({ type: "selectFile", field: "plan" }),
    ).resolves.not.toThrow();
    expect(createAndActivatePlan).not.toHaveBeenCalled();
  });

  it("selectFile with field:plan dialog picks file → createAndActivatePlan called with relPath", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const createAndActivatePlan = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), createAndActivatePlan });
    const fakeUri = vscodeMock.Uri.file("/workspace/plans/new-plan.md");
    vi.spyOn(vscodeMock.window, "showOpenDialog").mockResolvedValue([fakeUri]);
    await view.__trigger({ type: "selectFile", field: "plan" });
    expect(createAndActivatePlan).toHaveBeenCalledOnce();
    expect(createAndActivatePlan).toHaveBeenCalledWith("plans/new-plan.md");
  });

  it("selectFile with field:plan rejects file outside workspace → handler NOT called, error shown", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const createAndActivatePlan = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), createAndActivatePlan });
    const outsideUri = vscodeMock.Uri.file("/elsewhere/plans/new-plan.md");
    vi.spyOn(vscodeMock.window, "showOpenDialog").mockResolvedValue([
      outsideUri,
    ]);
    const errSpy = vi.spyOn(vscodeMock.window, "showErrorMessage");
    await view.__trigger({ type: "selectFile", field: "plan" });
    expect(createAndActivatePlan).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledOnce();
  });

  it("changeActivePlanFile rejects file outside workspace → handler NOT called, ok:false posted", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const changeActivePlanFile = vi.fn(() => Promise.resolve());
    provider.setPlanHandlers({ ...noopPlanHandlers(), changeActivePlanFile });
    const outsideUri = vscodeMock.Uri.file("/elsewhere/plans/chapter1.md");
    vi.spyOn(vscodeMock.window, "showOpenDialog").mockResolvedValue([
      outsideUri,
    ]);
    const errSpy = vi.spyOn(vscodeMock.window, "showErrorMessage");
    await view.__trigger({ type: "changeActivePlanFile" });
    expect(changeActivePlanFile).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledOnce();
    expect(view.__posted).toContainEqual({
      type: "changeActivePlanFileResult",
      ok: false,
      error: "outside_workspace",
    });
  });

  it("clearFile with field:plan throws — plan is managed by Plan Panel", async () => {
    const provider = new SidebarProvider(
      vscodeMock.Uri.file("/ext") as unknown as ConstructorParameters<
        typeof SidebarProvider
      >[0],
    );
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    await expect(
      view.__trigger({ type: "clearFile", field: "plan" }),
    ).rejects.toThrow("mentorFiles.plan is managed by Plan Panel, not Sidebar");
  });
});
