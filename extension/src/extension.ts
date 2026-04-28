import type { CleanupOptions } from "@mentor-studio/shared";
import * as vscode from "vscode";
import { runCleanupMentor, runRemoveMentor } from "./commands/removeMentor";
import { runSetup } from "./commands/setup";
import { runMigrationsForActivation } from "./migration/runAll";
import { cleanupOrphanProgressJson } from "./migration/v2ProfileAppState";
import { PlanPanel } from "./panels/planPanel";
import { BroadcastBus } from "./services/broadcastBus";
import { FileWatcherService } from "./services/fileWatcher";
import { resolveLocale } from "./utils/locale";
import { SidebarProvider } from "./views/sidebarProvider";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  const outputChannel = vscode.window.createOutputChannel("Mentor Studio Code");
  context.subscriptions.push(outputChannel);
  const getOutputChannel = (): vscode.OutputChannel => outputChannel;

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
  const wasmPath = vscode.Uri.joinPath(
    context.extensionUri,
    "dist",
    "sql-wasm.wasm",
  ).fsPath;

  // Run migrations BEFORE computing dbPath / constructing the watcher / wiring
  // the openPlanPanel command — v3 relocates the DB file from the legacy
  // in-workspace path to an external per-workspaceId path, and downstream
  // closures must capture the post-migration dbPath.
  let migrationResult: Awaited<ReturnType<typeof runMigrationsForActivation>>;
  try {
    migrationResult = await runMigrationsForActivation({
      workspaceRoot: workspaceRoot.fsPath,
      wasmPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await context.globalState.update("mentor.migrationError", {
      timestamp: new Date().toISOString(),
      message,
    });
    // Locale isn't reliably known at this point (config.json may exist but
    // the watcher hasn't loaded it yet). Best-effort detect via vscode.env.language.
    const isJa = vscode.env.language.startsWith("ja");
    void vscode.window.showErrorMessage(
      isJa
        ? `Mentor: データ移行に失敗しました。詳細: ${message}`
        : `Mentor: data migration failed. Detail: ${message}`,
    );
    return; // Do not proceed to feature activation — DB state is unknown.
  }

  if (migrationResult.status === "noConfig") {
    // Setup has not run yet; sidebar shows the "Run Setup" prompt.
    sidebarProvider.sendNoConfig();
    return;
  }

  if (migrationResult.status === "needsMigration") {
    // v0.6.6 moved the DB outside the workspace, but the actual relocation
    // happens inside Setup so the user explicitly opts in. Skip feature wiring
    // (commands / file watcher) and surface a Setup prompt — both via the
    // sidebar and a toast — without registering anything that would touch the
    // legacy DB path.
    sidebarProvider.sendNeedsMigration();
    const locale = await resolveLocale(workspaceRoot.fsPath);
    const isJa = locale === "ja";
    const button = isJa ? "Setup を実行" : "Run Setup";
    void vscode.window
      .showInformationMessage(
        isJa
          ? "Mentor Studio Code v0.6.6 への移行のため Setup を実行してください。"
          : "Mentor Studio Code needs Setup to migrate to v0.6.6.",
        button,
      )
      .then((choice) => {
        if (choice === button) {
          void vscode.commands.executeCommand("mentor-studio.setup");
        }
      });
    return;
  }

  // Best-effort orphan-JSON cleanup (separate from migrations — covers the
  // crash window between DB write and progress.json unlink).
  try {
    const orphan = await cleanupOrphanProgressJson(
      migrationResult.paths.mentorRoot,
      wasmPath,
    );
    if (!orphan.ok) {
      getOutputChannel().appendLine(
        `orphan progress.json cleanup failed: ${orphan.error} ${orphan.detail ?? ""}`,
      );
    }
  } catch (err) {
    getOutputChannel().appendLine(
      `orphan progress.json cleanup threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const dbPath = migrationResult.paths.dbPath; // external from now on

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
        void sidebarProvider.sendConfig(config);
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
          void sidebarProvider.sendConfig(config);

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

  startWatcher();

  context.subscriptions.push(watcher);
}

export function deactivate(): void {
  // cleanup handled by disposables
}
