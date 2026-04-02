import * as vscode from "vscode";
import { runSetup } from "./commands/setup";
import { FileWatcherService } from "./services/fileWatcher";
import { SidebarProvider } from "./views/sidebarProvider";

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Mentor Studio");
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

  // If no workspace, nothing more to do
  if (!workspaceRoot) {
    return;
  }

  const mentorPath = vscode.workspace
    .getConfiguration("mentor-studio")
    .get<string>("mentorFilesPath", "docs/mentor");

  // Sidebar provider
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "mentor-studio.sidebar",
      sidebarProvider,
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
    },
    (msg) => getOutputChannel().appendLine(msg),
  );

  sidebarProvider.setTopicHandlers({
    mergeTopic: (fromKey, toKey) => watcher.mergeTopic(fromKey, toKey),
    updateTopicLabel: (key, newLabel) =>
      watcher.updateTopicLabel(key, newLabel),
    addTopic: (label) => watcher.addTopic(label),
  });

  const currentPkg = context.extension.packageJSON as Record<string, unknown>;
  const currentVersion =
    typeof currentPkg.version === "string" ? currentPkg.version : "0.0.0";

  void watcher
    .start()
    .then(() => {
      const config = watcher.getConfig();
      if (config) {
        sidebarProvider.sendConfig(config);

        // Version check: prompt setup if extension was updated
        if (config.extensionVersion !== currentVersion) {
          const isJa = config.locale !== "en";
          const message = isJa
            ? `Mentor Studio が更新されました (v${currentVersion})。最新のプロンプトを適用するには Setup を実行してください。`
            : `Mentor Studio has been updated (v${currentVersion}). Run Setup to apply the latest prompts.`;
          const button = isJa ? "Setup を実行" : "Run Setup";
          void vscode.window
            .showInformationMessage(message, { modal: true }, button)
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
