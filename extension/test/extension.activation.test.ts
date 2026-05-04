import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import * as vscodeMock from "./__mocks__/vscode";

vi.mock("../src/migration/runAll", () => ({
  runMigrationsForActivation: vi.fn(async () => ({
    status: "ok",
    paths: {
      mentorRoot: "/workspace/.mentor",
      dbPath: "/state/workspace/data.db",
    },
  })),
}));

vi.mock("../src/commands/setup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/commands/setup")>();
  return {
    ...actual,
    runSetup: vi.fn(async (_context, _outputChannel, options) => {
      await options.onCompleted?.();
    }),
  };
});

vi.mock("../src/migration/v2ProfileAppState", () => ({
  cleanupOrphanProgressJson: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../src/services/fileWatcher", () => ({
  FileWatcherService: vi.fn(function () {
    return {
      start: vi.fn(async () => undefined),
      getConfig: vi.fn(() => ({ repositoryName: "repo", locale: "en" })),
      refresh: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
  }),
}));

vi.mock("../src/views/sidebarProvider", () => ({
  SidebarProvider: vi.fn(function () {
    return {
      getSubscriber: vi.fn(() => ({ postMessage: vi.fn() })),
      sendConfig: vi.fn(async () => undefined),
      sendNoConfig: vi.fn(),
      sendNeedsMigration: vi.fn(),
      setTopicHandlers: vi.fn(),
      setPlanHandlers: vi.fn(),
    };
  }),
}));

describe("activate", () => {
  async function activateWithConfigVersion(
    configVersion: string | undefined,
    notificationChoice?: string,
  ) {
    const messages: string[] = [];
    const globalState = {
      get: vi.fn(() => undefined),
      update: vi.fn(async () => undefined),
    };
    const context = {
      extensionUri: vscodeMock.Uri.file("/ext"),
      extension: { packageJSON: { version: "0.6.9" } },
      subscriptions: [] as { dispose(): void }[],
      globalState,
    };
    const showInformationMessageMock = async (
      message: string,
      ...items: unknown[]
    ): Promise<unknown> => {
        messages.push(message);
        return notificationChoice && items.includes(notificationChoice)
          ? notificationChoice
          : undefined;
    };
    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      showInformationMessageMock as typeof vscode.window.showInformationMessage,
    );
    const { FileWatcherService } = await import(
      "../src/services/fileWatcher.js"
    );
    vi.mocked(FileWatcherService).mockImplementation(
      function () {
        return {
          start: vi.fn(async () => undefined),
          getConfig: vi.fn(() => ({
            repositoryName: "repo",
            locale: "en",
            extensionVersion: configVersion,
          })),
          refresh: vi.fn(async () => undefined),
          dispose: vi.fn(),
        };
      } as never,
    );

    const { activate } = await import("../src/extension.js");
    await activate(context as unknown as vscode.ExtensionContext);
    await vi.waitFor(() => {
      expect(FileWatcherService).toHaveBeenCalled();
    });
    await Promise.resolve();
    return messages;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    (
      vscodeMock.workspace as unknown as {
        workspaceFolders: { uri: vscodeMock.MockUri }[] | undefined;
      }
    ).workspaceFolders = [{ uri: vscodeMock.Uri.file("/workspace") }];
  });

  it("shows the setup notification when workspace prompts are older than the extension", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand");
    const messages = await activateWithConfigVersion("0.6.8", "Run Setup");

    await vi.waitFor(() => {
      expect(messages).toContain(
        "Mentor Studio Code has been updated (v0.6.9). Run Setup to apply the latest prompts.",
      );
    });
    await vi.waitFor(() => {
      expect(executeCommand).toHaveBeenCalledWith("mentor-studio.setup", {
        source: "versionNotification",
        entrypointPrompt: "whenMissing",
      });
    });
  });

  it("does not show the setup notification after setup records the current prompt version", async () => {
    const messages = await activateWithConfigVersion("0.6.9");

    expect(messages).not.toContain(
      "Mentor Studio Code has been updated (v0.6.9). Run Setup to apply the latest prompts.",
    );
  });

  it("shows a setup notification for a no-config workspace", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand");
    const messages: string[] = [];
    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      (async (message: string, ...items: unknown[]) => {
        messages.push(message);
        return items.includes("Setup を実行") ? "Setup を実行" : undefined;
      }) as typeof vscode.window.showInformationMessage,
    );
    const { runMigrationsForActivation } = await import(
      "../src/migration/runAll.js"
    );
    vi.mocked(runMigrationsForActivation).mockResolvedValueOnce({
      status: "noConfig",
      workspaceId: null,
      paths: {
        mentorRoot: "/workspace/.mentor",
        configPath: "/workspace/.mentor/config.json",
        dbPath: "/workspace/.mentor/data.db",
        externalDbPath: null,
        externalDataDir: "/state",
        externalDataDirForWorkspace: null,
        legacyInWorkspaceDbPath: "/workspace/.mentor/data.db",
      },
    });
    const { FileWatcherService } = await import(
      "../src/services/fileWatcher.js"
    );
    vi.mocked(FileWatcherService).mockClear();

    const { activate } = await import("../src/extension.js");
    const context = {
      extensionUri: vscodeMock.Uri.file("/ext"),
      extension: { packageJSON: { version: "0.6.9" } },
      subscriptions: [] as { dispose(): void }[],
      globalState: {
        get: vi.fn(() => undefined),
        update: vi.fn(async () => undefined),
      },
    };

    await activate(context as unknown as vscode.ExtensionContext);

    expect(FileWatcherService).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(messages).toContain(
        "Mentor Studio Code の Setup をしてください。",
      );
    });
    expect(executeCommand).toHaveBeenCalledWith("mentor-studio.setup", {
      source: "sidebarNoConfig",
      entrypointPrompt: "whenMissing",
    });
  });

  it("shows the no-config setup notification in English", async () => {
    const messages: string[] = [];
    const originalLanguage = vscodeMock.env.language;
    vscodeMock.env.language = "en";
    vi.spyOn(vscode.window, "showInformationMessage").mockImplementation(
      (async (message: string) => {
        messages.push(message);
        return undefined;
      }) as typeof vscode.window.showInformationMessage,
    );
    const { runMigrationsForActivation } = await import(
      "../src/migration/runAll.js"
    );
    vi.mocked(runMigrationsForActivation).mockResolvedValueOnce({
      status: "noConfig",
      workspaceId: null,
      paths: {
        mentorRoot: "/workspace/.mentor",
        configPath: "/workspace/.mentor/config.json",
        dbPath: "/workspace/.mentor/data.db",
        externalDbPath: null,
        externalDataDir: "/state",
        externalDataDirForWorkspace: null,
        legacyInWorkspaceDbPath: "/workspace/.mentor/data.db",
      },
    });

    try {
      const { activate } = await import("../src/extension.js");
      const context = {
        extensionUri: vscodeMock.Uri.file("/ext"),
        extension: { packageJSON: { version: "0.6.9" } },
        subscriptions: [] as { dispose(): void }[],
        globalState: {
          get: vi.fn(() => undefined),
          update: vi.fn(async () => undefined),
        },
      };

      await activate(context as unknown as vscode.ExtensionContext);

      expect(messages).toContain("Set up Mentor Studio Code.");
    } finally {
      vscodeMock.env.language = originalLanguage;
    }
  });

  it("starts the configured runtime after setup completes in a no-config workspace", async () => {
    const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
    vi.spyOn(vscode.commands, "registerCommand").mockImplementation(
      ((command: string, handler: (...args: unknown[]) => unknown) => {
        registeredCommands.set(command, handler);
        return { dispose: vi.fn() };
      }) as typeof vscode.commands.registerCommand,
    );

    const { runMigrationsForActivation } = await import(
      "../src/migration/runAll.js"
    );
    vi.mocked(runMigrationsForActivation)
      .mockResolvedValueOnce({
        status: "noConfig",
        workspaceId: null,
        paths: {
          mentorRoot: "/workspace/.mentor",
          configPath: "/workspace/.mentor/config.json",
          dbPath: "/workspace/.mentor/data.db",
          externalDbPath: null,
          externalDataDir: "/state",
          externalDataDirForWorkspace: null,
          legacyInWorkspaceDbPath: "/workspace/.mentor/data.db",
        },
      })
      .mockResolvedValueOnce({
        status: "ok",
        workspaceId: "repo-123",
        paths: {
          mentorRoot: "/workspace/.mentor",
          configPath: "/workspace/.mentor/config.json",
          dbPath: "/state/workspace/data.db",
          externalDbPath: "/state/workspace/data.db",
          externalDataDir: "/state",
          externalDataDirForWorkspace: "/state/workspace",
          legacyInWorkspaceDbPath: "/workspace/.mentor/data.db",
        },
      });

    const { FileWatcherService } = await import(
      "../src/services/fileWatcher.js"
    );
    vi.mocked(FileWatcherService).mockClear();
    const { activate } = await import("../src/extension.js");
    const context = {
      extensionUri: vscodeMock.Uri.file("/ext"),
      extension: { packageJSON: { version: "0.6.9" } },
      subscriptions: [] as { dispose(): void }[],
      globalState: {
        get: vi.fn(() => undefined),
        update: vi.fn(async () => undefined),
      },
    };

    await activate(context as unknown as vscode.ExtensionContext);
    expect(FileWatcherService).not.toHaveBeenCalled();

    const setupHandler = registeredCommands.get("mentor-studio.setup");
    expect(setupHandler).toBeDefined();
    await setupHandler?.({ source: "sidebarNoConfig" });

    expect(FileWatcherService).toHaveBeenCalledTimes(1);
  });

  it("does not keep partial runtime command registrations when watcher startup fails", async () => {
    const commandRegistrations = new Map<string, number>();
    const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
    vi.spyOn(vscode.commands, "registerCommand").mockImplementation(
      ((command: string, handler: (...args: unknown[]) => unknown) => {
        commandRegistrations.set(
          command,
          (commandRegistrations.get(command) ?? 0) + 1,
        );
        registeredCommands.set(command, handler);
        return { dispose: vi.fn() };
      }) as typeof vscode.commands.registerCommand,
    );

    const { runMigrationsForActivation } = await import(
      "../src/migration/runAll.js"
    );
    vi.mocked(runMigrationsForActivation)
      .mockResolvedValueOnce({
        status: "ok",
        workspaceId: "repo-123",
        paths: {
          mentorRoot: "/workspace/.mentor",
          configPath: "/workspace/.mentor/config.json",
          dbPath: "/state/workspace/data.db",
          externalDbPath: "/state/workspace/data.db",
          externalDataDir: "/state",
          externalDataDirForWorkspace: "/state/workspace",
          legacyInWorkspaceDbPath: "/workspace/.mentor/data.db",
        },
      })
      .mockResolvedValueOnce({
        status: "ok",
        workspaceId: "repo-123",
        paths: {
          mentorRoot: "/workspace/.mentor",
          configPath: "/workspace/.mentor/config.json",
          dbPath: "/state/workspace/data.db",
          externalDbPath: "/state/workspace/data.db",
          externalDataDir: "/state",
          externalDataDirForWorkspace: "/state/workspace",
          legacyInWorkspaceDbPath: "/workspace/.mentor/data.db",
        },
      });

    const { FileWatcherService } = await import(
      "../src/services/fileWatcher.js"
    );
    vi.mocked(FileWatcherService).mockClear();
    vi.mocked(FileWatcherService)
      .mockImplementationOnce(
        function () {
          return {
            start: vi.fn(async () => {
              throw new Error("watcher failed");
            }),
            getConfig: vi.fn(),
            refresh: vi.fn(async () => undefined),
            dispose: vi.fn(),
          };
        } as never,
      )
      .mockImplementationOnce(
        function () {
          return {
            start: vi.fn(async () => undefined),
            getConfig: vi.fn(() => ({
              repositoryName: "repo",
              locale: "en",
              extensionVersion: "0.6.9",
            })),
            refresh: vi.fn(async () => undefined),
            dispose: vi.fn(),
          };
        } as never,
      );

    const { activate } = await import("../src/extension.js");
    const context = {
      extensionUri: vscodeMock.Uri.file("/ext"),
      extension: { packageJSON: { version: "0.6.9" } },
      subscriptions: [] as { dispose(): void }[],
      globalState: {
        get: vi.fn(() => undefined),
        update: vi.fn(async () => undefined),
      },
    };

    await activate(context as unknown as vscode.ExtensionContext);

    const setupHandler = registeredCommands.get("mentor-studio.setup");
    expect(setupHandler).toBeDefined();
    await setupHandler?.({ source: "commandPalette" });

    expect(FileWatcherService).toHaveBeenCalledTimes(2);
    expect(commandRegistrations.get("mentor-studio.openPlanPanel")).toBe(1);
    expect(commandRegistrations.get("mentor-studio.addFilesToPlan")).toBe(1);
    expect(commandRegistrations.get("mentor-studio.setFileAsSpec")).toBe(1);
  });
});
