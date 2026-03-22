import * as vscode from "vscode";
import { FileWatcherService } from "./services/fileWatcher";
import { SidebarProvider } from "./views/sidebarProvider";

export function activate(context: vscode.ExtensionContext): void {
  // Task 11 — register setup command (before workspace check so it always works)
  const setupCommand = vscode.commands.registerCommand(
    "mentor-studio.setup",
    async () => {
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!wsRoot) {
        vscode.window.showErrorMessage("Open a folder first.");
        return;
      }

      const configUri = vscode.Uri.joinPath(wsRoot, ".mentor-studio.json");

      try {
        await vscode.workspace.fs.stat(configUri);
        vscode.window.showInformationMessage(
          ".mentor-studio.json already exists.",
        );
        return;
      } catch {
        // file doesn't exist — create it
      }

      const folderName =
        vscode.workspace.workspaceFolders?.[0]?.name ?? "my-project";
      const config = {
        repositoryName: folderName,
        topics: [
          { key: "html", label: "HTML" },
          { key: "css", label: "CSS" },
          { key: "javascript", label: "JavaScript" },
          { key: "typescript", label: "TypeScript" },
        ],
      };

      const content = Buffer.from(JSON.stringify(config, null, 2) + "\n");
      await vscode.workspace.fs.writeFile(configUri, content);
      vscode.window.showInformationMessage(
        "Created .mentor-studio.json. Reload window to activate.",
      );
    },
  );
  context.subscriptions.push(setupCommand);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceRoot) {
    return;
  }

  const mentorPath = vscode.workspace
    .getConfiguration("mentor-studio")
    .get<string>("mentorFilesPath", "docs/mentor");

  // Task 7 — register sidebar provider
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "mentor-studio.sidebar",
      sidebarProvider,
    ),
  );

  // Task 6 — register file watcher
  const watcher = new FileWatcherService(
    workspaceRoot.fsPath,
    mentorPath,
    (data) => sidebarProvider.sendUpdate(data),
  );

  watcher.start().then(() => {
    const config = watcher.getConfig();
    if (config) {
      sidebarProvider.sendConfig(config);
    } else {
      sidebarProvider.sendNoConfig();
    }
  });

  context.subscriptions.push(watcher);

  console.log("Mentor Studio activated");
}

export function deactivate(): void {
  // cleanup handled by disposables
}
