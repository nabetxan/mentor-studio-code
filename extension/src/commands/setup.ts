import * as vscode from "vscode";
import { findMentorRef, promptAndAddMentorRef } from "../services/claudeMd";
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
} from "../templates/mentorFiles";

async function writeIfMissing(
  uri: vscode.Uri,
  content: string,
): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return false;
  } catch (err) {
    if (err instanceof vscode.FileSystemError && err.code === "FileNotFound") {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
      return true;
    }
    throw err;
  }
}

export async function runSetup(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!wsRoot) {
    const isJa = vscode.env.language.startsWith("ja");
    const openLabel = isJa ? "フォルダを開く" : "Open Folder";
    const choice = await vscode.window.showErrorMessage(
      isJa ? "先にフォルダを開いてください。" : "Open a folder first.",
      openLabel,
    );
    if (choice === openLabel) {
      await vscode.commands.executeCommand("vscode.openFolder");
    }
    return;
  }

  const mentorFilesPath = ".mentor";

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

  // Create or update .mentor/config.json
  const configUri = vscode.Uri.joinPath(wsRoot, ".mentor", "config.json");
  const pkg = context.extension.packageJSON as Record<string, unknown>;
  const extensionVersion =
    typeof pkg.version === "string" ? pkg.version : "0.0.0";

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
    if (!existingConfig.workspacePath) {
      existingConfig.workspacePath = wsRoot.fsPath;
    }
    delete (existingConfig as Record<string, unknown>).extensionUninstalled;
    await vscode.workspace.fs.writeFile(
      configUri,
      Buffer.from(JSON.stringify(existingConfig, null, 2) + "\n"),
    );
    skippedFiles.push(".mentor/config.json (updated version)");
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
          workspacePath: wsRoot.fsPath,
        },
        null,
        2,
      ) + "\n";
    await vscode.workspace.fs.writeFile(configUri, Buffer.from(configContent));
    createdFiles.push(".mentor/config.json");
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
  const intakeDirUri = vscode.Uri.joinPath(mentorDirUri, "skills", "intake");
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
  const refStatus = await findMentorRef(wsRoot);
  let claudeAction = "skipped (already contains mentorRef)";

  if (!refStatus.personal && !refStatus.project) {
    const result = await promptAndAddMentorRef(wsRoot, isJa);
    if (result === "project") {
      claudeAction = "added to project CLAUDE.md";
    } else if (result === "personal") {
      claudeAction = "added to personal CLAUDE.md";
    } else {
      claudeAction = "skipped by user";
    }
  }

  // Output results
  outputChannel.appendLine("=== Mentor Studio Code Setup Results ===");
  outputChannel.appendLine(
    `Created: ${createdFiles.join(", ") || "none (all existed)"}`,
  );
  outputChannel.appendLine(`Skipped: ${skippedFiles.join(", ") || "none"}`);
  outputChannel.appendLine(`CLAUDE.md: ${claudeAction}`);
  outputChannel.show(true);

  // Prompt reload with a button
  const reloadButton = isJa ? "ウィンドウを再読み込み" : "Reload Window";
  const choice = await vscode.window.showInformationMessage(
    isJa
      ? "Mentor Studio Code のセットアップが完了しました！ダッシュボードを有効にするにはリロードしてください。"
      : "Mentor Studio Code setup complete! Reload to activate the dashboard.",
    { modal: true },
    reloadButton,
  );
  if (choice === reloadButton) {
    vscode.commands.executeCommand("workbench.action.reloadWindow");
  }
}
