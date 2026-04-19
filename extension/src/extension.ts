import type { CleanupOptions } from "@mentor-studio/shared";
import { relative } from "node:path";
import * as vscode from "vscode";
import { runCleanupMentor, runRemoveMentor } from "./commands/removeMentor";
import { runSetup } from "./commands/setup";
import { migrate } from "./migration/migrate";
import { shouldMigrate } from "./migration/shouldMigrate";
import { PlanPanel } from "./panels/planPanel";
import { BroadcastBus } from "./services/broadcastBus";
import { FileWatcherService } from "./services/fileWatcher";
import { SidebarProvider } from "./views/sidebarProvider";

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Mentor Studio Code");
  }
  return outputChannel;
}

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  // Setup command — always available
  const setupCommand = vscode.commands.registerCommand(
    "mentor-studio.setup",
    () => runSetup(context, getOutputChannel()),
  );
  context.subscriptions.push(setupCommand);

  const removeMentorCommand = vscode.commands.registerCommand(
    "mentor-studio.removeMentor",
    () => runRemoveMentor(getOutputChannel()),
  );
  context.subscriptions.push(removeMentorCommand);

  // Sidebar provider — package.json hides the view when workspaceFolderCount == 0,
  // so this only runs when a folder is open.
  const sidebarProvider = new SidebarProvider(context.extensionUri);

  const cleanupMentorCommand = vscode.commands.registerCommand(
    "mentor-studio.cleanupMentor",
    (options: CleanupOptions) =>
      runCleanupMentor(
        options,
        getOutputChannel(),
        context.globalState,
        (deleted, isJa) =>
          sidebarProvider.showCleanupResultDialog(deleted, isJa),
        () => sidebarProvider.sendNoConfig(),
      ),
  );
  context.subscriptions.push(cleanupMentorCommand);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "mentor-studio.sidebar",
      sidebarProvider,
    ),
  );

  if (!workspaceRoot) {
    return;
  }

  const mentorPath = ".mentor";
  const mentorDir = vscode.Uri.joinPath(workspaceRoot, mentorPath).fsPath;
  const dbPath = vscode.Uri.joinPath(
    workspaceRoot,
    mentorPath,
    "data.db",
  ).fsPath;
  const wasmPath = vscode.Uri.joinPath(
    context.extensionUri,
    "dist",
    "sql-wasm.wasm",
  ).fsPath;

  const bus = new BroadcastBus();
  const unregisterSidebar = bus.register(sidebarProvider.getSubscriber());
  context.subscriptions.push({ dispose: () => unregisterSidebar() });

  context.subscriptions.push(
    vscode.commands.registerCommand("mentor-studio.openPlanPanel", () => {
      const workspaceRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
      // Every Plan Panel write refreshes the sidebar dashboard and broadcasts
      // dbChanged so the panel's own webview re-fetches a fresh snapshot.
      // Mirrors what FileWatcherService runs for sidebar-initiated writes.
      const onAfterWrite = async (): Promise<void> => {
        await watcher.refresh();
        bus.broadcast({ type: "dbChanged" });
      };
      PlanPanel.createOrShow(
        context,
        bus,
        { dbPath, wasmPath, workspaceRoot },
        onAfterWrite,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mentor-studio.addFilesToPlan",
      async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
        const targets = uris && uris.length > 0 ? uris : [uri];
        await watcher.addFilesToPlan(targets);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mentor-studio.setFileAsSpec",
      async (uri: vscode.Uri) => {
        if (!uri) return;
        await watcher.setFileAsSpec(uri);
      },
    ),
  );

  // File watcher
  const watcher = new FileWatcherService(
    workspaceRoot.fsPath,
    mentorPath,
    (data) => sidebarProvider.sendUpdate(data),
    (config) => {
      if (config !== null) {
        sidebarProvider.sendConfig(config);
      } else {
        sidebarProvider.sendNoConfig();
      }
      // Reuse dbChanged so the Plan Panel re-fetches initData — that's where
      // locale lives, so a config-file edit (e.g. locale flipped in Settings)
      // propagates to an open panel without needing its own message type.
      bus.broadcast({ type: "dbChanged" });
    },
    (msg) => getOutputChannel().appendLine(msg),
    context.globalState,
    async () => {
      bus.broadcast({ type: "dbChanged" });
    },
    dbPath,
    wasmPath,
  );

  sidebarProvider.setTopicHandlers({
    mergeTopic: (fromKey, toKey) => watcher.mergeTopic(fromKey, toKey),
    updateTopicLabel: (key, newLabel) =>
      watcher.updateTopicLabel(key, newLabel),
    addTopic: (label) => watcher.addTopic(label),
    deleteTopics: (keys) => watcher.deleteTopics(keys),
  });

  sidebarProvider.setPlanHandlers({
    activatePlan: (id) => watcher.activatePlan(id),
    deactivatePlan: (id) => watcher.deactivatePlan(id),
    pauseActivePlan: (id) => watcher.pauseActivePlan(id),
    changeActivePlanFile: (relPath) => watcher.changeActivePlanFile(relPath),
    createAndActivatePlan: (relPath) => watcher.createAndActivatePlan(relPath),
  });

  const currentPkg = context.extension.packageJSON as Record<string, unknown>;
  const currentVersion =
    typeof currentPkg.version === "string" ? currentPkg.version : "0.0.0";

  // Version check using globalState (persists across sessions, independent of workspace)
  const previousVersion = context.globalState.get<string>("extensionVersion");
  const isVersionUpdated =
    previousVersion !== undefined && previousVersion !== currentVersion;
  void context.globalState.update("extensionVersion", currentVersion);

  const startWatcher = (): void => {
    void watcher
      .start()
      .then(() => {
        const config = watcher.getConfig();
        if (config) {
          sidebarProvider.sendConfig(config);

          if (isVersionUpdated) {
            const isJa = config.locale !== "en";
            const message = isJa
              ? `Mentor Studio Code が更新されました (v${currentVersion})。最新のプロンプトを適用するには Setup を実行してください。`
              : `Mentor Studio Code has been updated (v${currentVersion}). Run Setup to apply the latest prompts.`;
            const button = isJa ? "Setup を実行" : "Run Setup";
            void vscode.window
              .showInformationMessage(message, button)
              .then((choice) => {
                if (choice === button) {
                  void vscode.commands.executeCommand("mentor-studio.setup");
                }
              });
          }
        } else {
          sidebarProvider.sendNoConfig();
        }
      })
      .catch((err: unknown) => {
        getOutputChannel().appendLine(
          `Failed to start file watcher: ${String(err)}`,
        );
        sidebarProvider.sendNoConfig();
      });
  };

  if (shouldMigrate(mentorDir)) {
    void (async () => {
      try {
        const result = await migrate(mentorDir, wasmPath);
        if (result.ok) {
          const rel = (p: string): string => relative(mentorDir, p) || p;
          void vscode.window.showInformationMessage(
            `Mentor data migrated to SQLite (${result.stats.questions} questions, ${result.stats.plans} plans). ` +
              `Backups kept at: ${result.bakPaths.map(rel).join(", ")}.`,
          );
        } else if (result.error === "migration_partial") {
          void vscode.window.showWarningMessage(
            `Mentor migration completed in DB but JSON rewrite failed: ${result.detail ?? ""}`,
          );
        } else {
          void vscode.window.showErrorMessage(
            `Mentor migration failed: ${result.detail ?? ""}. Rerun after checking logs.`,
          );
        }
      } catch (err) {
        getOutputChannel().appendLine(
          `Migration threw: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        startWatcher();
      }
    })();
  } else {
    startWatcher();
  }

  context.subscriptions.push(watcher);
}

export function deactivate(): void {
  // cleanup handled by disposables
}
