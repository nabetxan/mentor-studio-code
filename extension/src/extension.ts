import * as vscode from "vscode";
import { runRemoveMentor } from "./commands/removeMentor";
import { runSetup } from "./commands/setup";
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

  // Sidebar provider — register before workspace check so the panel is
  // visible even when no folder is open.
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "mentor-studio.sidebar",
      sidebarProvider,
    ),
  );

  // If no workspace, show the "no config" state and stop
  if (!workspaceRoot) {
    sidebarProvider.sendNoConfig();
    return;
  }

  const mentorPath = ".mentor";

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
    },
    (msg) => getOutputChannel().appendLine(msg),
  );

  sidebarProvider.setTopicHandlers({
    mergeTopic: (fromKey, toKey) => watcher.mergeTopic(fromKey, toKey),
    updateTopicLabel: (key, newLabel) =>
      watcher.updateTopicLabel(key, newLabel),
    addTopic: (label) => watcher.addTopic(label),
    deleteTopic: (key) => watcher.deleteTopic(key),
  });

  const currentPkg = context.extension.packageJSON as Record<string, unknown>;
  const currentVersion =
    typeof currentPkg.version === "string" ? currentPkg.version : "0.0.0";

  // Version check using globalState (persists across sessions, independent of workspace)
  const previousVersion = context.globalState.get<string>("extensionVersion");
  const isVersionUpdated =
    previousVersion !== undefined && previousVersion !== currentVersion;
  void context.globalState.update("extensionVersion", currentVersion);

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

  context.subscriptions.push(watcher);
}

export function deactivate(): void {
  // cleanup handled by disposables
}
