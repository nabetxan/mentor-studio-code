import * as vscode from "vscode";
import { FileWatcherService } from "./services/fileWatcher";
import { SidebarProvider } from "./views/sidebarProvider";

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  // Setup command — always available
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

      const mentorFilesPath = vscode.workspace
        .getConfiguration("mentor-studio")
        .get<string>("mentorFilesPath", "docs/mentor");

      const folderName =
        vscode.workspace.workspaceFolders?.[0]?.name ?? "my-project";

      // Create .mentor-studio.json
      const config = {
        repositoryName: folderName,
        topics: [
          { key: "html", label: "HTML" },
          { key: "css", label: "CSS" },
          { key: "javascript", label: "JavaScript" },
          { key: "typescript", label: "TypeScript" },
        ],
      };
      await vscode.workspace.fs.writeFile(
        configUri,
        Buffer.from(JSON.stringify(config, null, 2) + "\n"),
      );

      // Create progress.json
      const progressUri = vscode.Uri.joinPath(
        wsRoot,
        mentorFilesPath,
        "progress.json",
      );
      const progress = {
        version: "1.0",
        current_task: "1",
        current_step: null,
        next_suggest: null,
        resume_context: null,
        completed_tasks: [],
        skipped_tasks: [],
        in_progress: [],
        unresolved_gaps: [],
      };
      await vscode.workspace.fs.writeFile(
        progressUri,
        Buffer.from(JSON.stringify(progress, null, 2) + "\n"),
      );

      // Create question-history.json
      const historyUri = vscode.Uri.joinPath(
        wsRoot,
        mentorFilesPath,
        "question-history.json",
      );
      await vscode.workspace.fs.writeFile(
        historyUri,
        Buffer.from(JSON.stringify({ history: [] }, null, 2) + "\n"),
      );

      // Prompt reload with a button
      const choice = await vscode.window.showInformationMessage(
        "Mentor Studio setup complete! Reload to activate the dashboard.",
        "Reload Window",
      );
      if (choice === "Reload Window") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    },
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
  );

  void watcher
    .start()
    .then(() => {
      const config = watcher.getConfig();
      if (config) {
        sidebarProvider.sendConfig(config);
      } else {
        sidebarProvider.sendNoConfig();
      }
    })
    .catch((err: unknown) => {
      console.error("Mentor Studio: failed to start file watcher", err);
      sidebarProvider.sendNoConfig();
    });

  context.subscriptions.push(watcher);

  console.log("Mentor Studio activated");
}

export function deactivate(): void {
  // cleanup handled by disposables
}
