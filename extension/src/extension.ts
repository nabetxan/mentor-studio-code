import * as os from "os";
import * as path from "path";
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
        const isJa = vscode.env.language.startsWith("ja");
        vscode.window.showErrorMessage(
          isJa ? "先にフォルダを開いてください。" : "Open a folder first.",
        );
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

      // Create or update .mentor-studio.json
      const configUri = vscode.Uri.joinPath(wsRoot, ".mentor-studio.json");
      const extensionVersion = (
        context.extension.packageJSON as { version: string }
      ).version;

      let existingConfig: Record<string, unknown> | null = null;
      try {
        const raw = await vscode.workspace.fs.readFile(configUri);
        existingConfig = JSON.parse(Buffer.from(raw).toString()) as Record<
          string,
          unknown
        >;
      } catch {
        // doesn't exist yet
      }

      const detectedLocale = vscode.env.language.startsWith("ja") ? "ja" : "en";

      if (existingConfig) {
        // Update extensionVersion in existing config
        existingConfig.extensionVersion = extensionVersion;
        await vscode.workspace.fs.writeFile(
          configUri,
          Buffer.from(JSON.stringify(existingConfig, null, 2) + "\n"),
        );
        skippedFiles.push(".mentor-studio.json (updated version)");
      } else {
        // Create new config
        const configContent =
          JSON.stringify(
            {
              repositoryName: folderName,
              enableMentor: true,
              topics: [
                { key: "a-html", label: "HTML" },
                { key: "a-css", label: "CSS" },
                { key: "a-javascript", label: "JavaScript" },
                { key: "a-typescript", label: "TypeScript" },
              ],
              mentorFiles: { spec: null, plan: null },
              locale: detectedLocale,
              extensionVersion,
            },
            null,
            2,
          ) + "\n";
        await vscode.workspace.fs.writeFile(
          configUri,
          Buffer.from(configContent),
        );
        createdFiles.push(".mentor-studio.json");
      }

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

      const isJa = existingConfig
        ? existingConfig.locale !== "en"
        : detectedLocale === "ja";

      // Handle CLAUDE.md — let user choose project-wide or personal
      const mentorRef = "@docs/mentor/rules/MENTOR_RULES.md";

      // Build personal CLAUDE.md path: ~/.claude/projects/-Users-xxx/CLAUDE.md
      const wsPath = wsRoot.fsPath;
      const projectDirName = wsPath.replace(/\//g, "-");
      const personalClaudeMdPath = path.join(
        os.homedir(),
        ".claude",
        "projects",
        projectDirName,
        "CLAUDE.md",
      );
      const personalClaudeMdUri = vscode.Uri.file(personalClaudeMdPath);
      const projectClaudeMdUri = vscode.Uri.joinPath(wsRoot, "CLAUDE.md");

      // Check if mentorRef already exists in either location
      let personalContent = "";
      let personalExists = false;
      let projectContent = "";
      let projectExists = false;

      try {
        const raw = await vscode.workspace.fs.readFile(personalClaudeMdUri);
        personalContent = Buffer.from(raw).toString();
        personalExists = true;
      } catch {
        // doesn't exist
      }

      try {
        const raw = await vscode.workspace.fs.readFile(projectClaudeMdUri);
        projectContent = Buffer.from(raw).toString();
        projectExists = true;
      } catch {
        // doesn't exist
      }

      const alreadyInPersonal = personalContent.includes(mentorRef);
      const alreadyInProject = projectContent.includes(mentorRef);

      let claudeAction = "skipped (already contains mentorRef)";

      if (!alreadyInPersonal && !alreadyInProject) {
        // Ask user where to add the reference
        const projectLabel = isJa
          ? "プロジェクト (CLAUDE.md)"
          : "Project (CLAUDE.md)";
        const personalLabel = isJa
          ? "個人設定 (~/.claude/projects/)"
          : "Personal (~/.claude/projects/)";
        const skipLabel = isJa ? "スキップ" : "Skip";

        const target = await vscode.window.showInformationMessage(
          isJa
            ? `メンター設定の参照をどこに追加しますか？\nプロジェクト: チーム全員に適用\n個人設定: 自分だけに適用`
            : `Where should the mentor config reference be added?\nProject: applies to the whole team\nPersonal: applies only to you`,
          { modal: true },
          projectLabel,
          personalLabel,
          skipLabel,
        );

        if (target === projectLabel) {
          if (!projectExists) {
            await vscode.workspace.fs.writeFile(
              projectClaudeMdUri,
              Buffer.from(mentorRef + "\n"),
            );
            claudeAction = "created project CLAUDE.md";
          } else {
            const newContent =
              projectContent.trimEnd() + "\n\n" + mentorRef + "\n";
            await vscode.workspace.fs.writeFile(
              projectClaudeMdUri,
              Buffer.from(newContent),
            );
            claudeAction = "appended to project CLAUDE.md";
          }
        } else if (target === personalLabel) {
          // Ensure the personal projects directory exists
          const personalDirUri = vscode.Uri.file(
            path.dirname(personalClaudeMdPath),
          );
          try {
            await vscode.workspace.fs.createDirectory(personalDirUri);
          } catch {
            // already exists
          }

          if (!personalExists) {
            await vscode.workspace.fs.writeFile(
              personalClaudeMdUri,
              Buffer.from(mentorRef + "\n"),
            );
            claudeAction = "created personal CLAUDE.md";
          } else {
            const newContent =
              personalContent.trimEnd() + "\n\n" + mentorRef + "\n";
            await vscode.workspace.fs.writeFile(
              personalClaudeMdUri,
              Buffer.from(newContent),
            );
            claudeAction = "appended to personal CLAUDE.md";
          }
        } else {
          claudeAction = "skipped by user";
        }
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
      const reloadButton = isJa ? "ウィンドウを再読み込み" : "Reload Window";
      const choice = await vscode.window.showInformationMessage(
        isJa
          ? "Mentor Studio のセットアップが完了しました！ダッシュボードを有効にするにはリロードしてください。"
          : "Mentor Studio setup complete! Reload to activate the dashboard.",
        { modal: true },
        reloadButton,
      );
      if (choice === reloadButton) {
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

  const currentVersion = (context.extension.packageJSON as { version: string })
    .version;

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
      console.error("Mentor Studio: failed to start file watcher", err);
      sidebarProvider.sendNoConfig();
    });

  context.subscriptions.push(watcher);
}

export function deactivate(): void {
  // cleanup handled by disposables
}
