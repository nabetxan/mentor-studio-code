import * as vscode from "vscode";
import { FileWatcherService } from "./services/fileWatcher";
import {
  CREATE_PLAN_MD,
  CREATE_SPEC_MD,
  CURRENT_TASK_MD,
  INTAKE_SKILL_MD,
  MENTOR_RULES_MD,
  MENTOR_SESSION_SKILL_MD,
  PROGRESS_JSON,
  QUESTION_HISTORY_JSON,
  TRACKER_FORMAT_MD,
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

      // Template files: always overwrite so updates to extension templates take effect
      const writeTemplate = async (
        uri: vscode.Uri,
        content: string,
        label: string,
      ): Promise<void> => {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
        createdFiles.push(label);
      };

      // Data files: only write if missing so user progress is never overwritten
      const writeDataIfMissing = async (
        uri: vscode.Uri,
        content: string,
        label: string,
      ): Promise<void> => {
        const created = await writeIfMissing(uri, content);
        (created ? createdFiles : skippedFiles).push(label);
      };

      // Create .mentor-studio.json (with mentorFiles field) — treat as data
      const configUri = vscode.Uri.joinPath(wsRoot, ".mentor-studio.json");
      const configContent =
        JSON.stringify(
          {
            repositoryName: folderName,
            enableMentor: true,
            topics: [
              { key: "html", label: "HTML" },
              { key: "css", label: "CSS" },
              { key: "javascript", label: "JavaScript" },
              { key: "typescript", label: "TypeScript" },
            ],
            mentorFiles: { spec: null, plan: null },
          },
          null,
          2,
        ) + "\n";
      await writeDataIfMissing(configUri, configContent, ".mentor-studio.json");

      // Prompt files — always overwrite
      await writeTemplate(
        vscode.Uri.joinPath(rulesDirUri, "MENTOR_RULES.md"),
        MENTOR_RULES_MD,
        "rules/MENTOR_RULES.md",
      );
      await writeTemplate(
        vscode.Uri.joinPath(rulesDirUri, "CREATE_PLAN.md"),
        CREATE_PLAN_MD,
        "rules/CREATE_PLAN.md",
      );
      await writeTemplate(
        vscode.Uri.joinPath(rulesDirUri, "CREATE_SPEC.md"),
        CREATE_SPEC_MD,
        "rules/CREATE_SPEC.md",
      );
      const mentorSessionDirUri = vscode.Uri.joinPath(
        mentorDirUri,
        "skills",
        "mentor-session",
      );
      await vscode.workspace.fs.createDirectory(mentorSessionDirUri);
      await writeTemplate(
        vscode.Uri.joinPath(mentorSessionDirUri, "SKILL.md"),
        MENTOR_SESSION_SKILL_MD,
        "skills/mentor-session/SKILL.md",
      );
      await writeTemplate(
        vscode.Uri.joinPath(mentorSessionDirUri, "tracker-format.md"),
        TRACKER_FORMAT_MD,
        "skills/mentor-session/tracker-format.md",
      );
      const intakeDirUri = vscode.Uri.joinPath(
        mentorDirUri,
        "skills",
        "intake",
      );
      await vscode.workspace.fs.createDirectory(intakeDirUri);
      await writeTemplate(
        vscode.Uri.joinPath(intakeDirUri, "SKILL.md"),
        INTAKE_SKILL_MD,
        "skills/intake/SKILL.md",
      );

      // Data files — only write if missing
      await writeDataIfMissing(
        vscode.Uri.joinPath(mentorDirUri, "progress.json"),
        PROGRESS_JSON + "\n",
        "progress.json",
      );
      await writeDataIfMissing(
        vscode.Uri.joinPath(mentorDirUri, "question-history.json"),
        QUESTION_HISTORY_JSON + "\n",
        "question-history.json",
      );
      await writeDataIfMissing(
        vscode.Uri.joinPath(mentorDirUri, "current-task.md"),
        CURRENT_TASK_MD,
        "current-task.md",
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

      let claudeAction = "skipped (already contains mentorRef)";

      if (!claudeExists) {
        // New project: auto-create without dialog
        await vscode.workspace.fs.writeFile(
          claudeMdUri,
          Buffer.from(mentorRef + "\n"),
        );
        claudeAction = "created (new file)";
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
      } else {
        // Already contains the reference, do nothing
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
    (config) => {
      if (config !== null) {
        sidebarProvider.sendConfig(config);
      } else {
        sidebarProvider.sendNoConfig();
      }
    },
  );

  sidebarProvider.setTopicHandlers({
    mergeTopic: (fromKey, toKey) => watcher.mergeTopic(fromKey, toKey),
    updateTopicLabel: (key, newLabel) =>
      watcher.updateTopicLabel(key, newLabel),
    addTopic: (label) => watcher.addTopic(label),
  });

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
}

export function deactivate(): void {
  // cleanup handled by disposables
}
