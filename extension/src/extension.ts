import * as vscode from "vscode";
import { FileWatcherService } from "./services/fileWatcher";
import {
  CORE_RULES_MD,
  CURRENT_TASK_MD,
  LEARNING_TRACKER_RULES_MD,
  MENTOR_RULES_MD,
  MENTOR_SKILL_MD,
  PROGRESS_JSON,
  QUESTION_HISTORY_JSON,
} from "./templates/mentorFiles";
import { SidebarProvider } from "./views/sidebarProvider";

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Mentor Studio");
  }
  return outputChannel;
}

async function writeIfMissing(
  uri: vscode.Uri,
  content: string,
): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return false;
  } catch {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    return true;
  }
}

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

      const mentorFilesPath = vscode.workspace
        .getConfiguration("mentor-studio")
        .get<string>("mentorFilesPath", "docs/mentor");

      const folderName =
        vscode.workspace.workspaceFolders?.[0]?.name ?? "my-project";

      // Ensure directories exist
      const mentorDirUri = vscode.Uri.joinPath(wsRoot, mentorFilesPath);
      const rulesDirUri = vscode.Uri.joinPath(mentorDirUri, "rules");
      await vscode.workspace.fs.createDirectory(mentorDirUri);
      await vscode.workspace.fs.createDirectory(rulesDirUri);

      const createdFiles: string[] = [];
      const skippedFiles: string[] = [];

      const trackWrite = async (
        uri: vscode.Uri,
        content: string,
        label: string,
      ): Promise<void> => {
        const created = await writeIfMissing(uri, content);
        (created ? createdFiles : skippedFiles).push(label);
      };

      // Create .mentor-studio.json (with mentorFiles field)
      const configUri = vscode.Uri.joinPath(wsRoot, ".mentor-studio.json");
      const configContent =
        JSON.stringify(
          {
            repositoryName: folderName,
            topics: [
              { key: "html", label: "HTML" },
              { key: "css", label: "CSS" },
              { key: "javascript", label: "JavaScript" },
              { key: "typescript", label: "TypeScript" },
            ],
            mentorFiles: { appDesign: null, roadmap: null },
          },
          null,
          2,
        ) + "\n";
      await trackWrite(configUri, configContent, ".mentor-studio.json");

      // Prompt files
      await trackWrite(
        vscode.Uri.joinPath(rulesDirUri, "MENTOR_RULES.md"),
        MENTOR_RULES_MD,
        "rules/MENTOR_RULES.md",
      );
      await trackWrite(
        vscode.Uri.joinPath(rulesDirUri, "MENTOR_SKILL.md"),
        MENTOR_SKILL_MD,
        "rules/MENTOR_SKILL.md",
      );
      await trackWrite(
        vscode.Uri.joinPath(rulesDirUri, "core-rules.md"),
        CORE_RULES_MD,
        "rules/core-rules.md",
      );
      await trackWrite(
        vscode.Uri.joinPath(rulesDirUri, "learning-tracker-rules.md"),
        LEARNING_TRACKER_RULES_MD,
        "rules/learning-tracker-rules.md",
      );

      // Data files
      await trackWrite(
        vscode.Uri.joinPath(mentorDirUri, "progress.json"),
        PROGRESS_JSON + "\n",
        "progress.json",
      );
      await trackWrite(
        vscode.Uri.joinPath(mentorDirUri, "question-history.json"),
        QUESTION_HISTORY_JSON + "\n",
        "question-history.json",
      );
      await trackWrite(
        vscode.Uri.joinPath(mentorDirUri, "current-task.md"),
        CURRENT_TASK_MD,
        "current-task.md",
      );

      console.log(
        "Mentor Studio Setup: all files written, starting CLAUDE.md handling",
      );

      // Handle CLAUDE.md
      const claudeMdUri = vscode.Uri.joinPath(wsRoot, "CLAUDE.md");
      const mentorRef = "@docs/mentor/rules/MENTOR_RULES.md";
      let claudeContent = "";
      let claudeExists = false;

      try {
        const raw = await vscode.workspace.fs.readFile(claudeMdUri);
        claudeContent = Buffer.from(raw).toString();
        claudeExists = true;
      } catch {
        // doesn't exist
      }

      console.log(
        "Mentor Studio Setup: claudeExists =",
        claudeExists,
        "includes mentorRef =",
        claudeContent.includes(mentorRef),
      );

      let claudeAction = "skipped (already contains mentorRef)";

      if (!claudeExists) {
        // New project: auto-create without dialog
        await vscode.workspace.fs.writeFile(
          claudeMdUri,
          Buffer.from(mentorRef + "\n"),
        );
        claudeAction = "created (new file)";
        console.log("Mentor Studio Setup: created CLAUDE.md");
      } else if (!claudeContent.includes(mentorRef)) {
        // Existing file: ask before appending
        const userChoice = await vscode.window.showInformationMessage(
          `Append "${mentorRef}" to CLAUDE.md?`,
          "Yes",
          "Skip",
        );
        if (userChoice === "Yes") {
          const newContent =
            claudeContent.trimEnd() + "\n\n" + mentorRef + "\n";
          await vscode.workspace.fs.writeFile(
            claudeMdUri,
            Buffer.from(newContent),
          );
          claudeAction = "appended";
        } else {
          claudeAction = "skipped by user";
        }
        console.log(
          "Mentor Studio Setup: CLAUDE.md append choice =",
          userChoice,
        );
      } else {
        console.log(
          "Mentor Studio Setup: CLAUDE.md already contains mentorRef, skipped",
        );
      }

      // Output results
      const ch = getOutputChannel();
      ch.appendLine("=== Mentor Studio Setup Results ===");
      ch.appendLine(
        `Created: ${createdFiles.join(", ") || "none (all existed)"}`,
      );
      ch.appendLine(`Skipped: ${skippedFiles.join(", ") || "none"}`);
      ch.appendLine(`CLAUDE.md: ${claudeAction}`);
      ch.show(true);

      // Prompt reload with a button
      console.log("Mentor Studio Setup: showing reload dialog");
      const choice = await vscode.window.showInformationMessage(
        "Mentor Studio setup complete! Reload to activate the dashboard.",
        "Reload Window",
      );
      if (choice === "Reload Window") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
      console.log("Mentor Studio Setup: setup complete");
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
