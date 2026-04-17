import { existsSync, promises as fsp } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { openDb } from "../db";
import { findMentorRef, promptAndAddMentorRef } from "../services/claudeMd";
import {
  COMPREHENSION_CHECK_SKILL_MD,
  CREATE_PLAN_MD,
  CREATE_SPEC_MD,
  CURRENT_TASK_MD,
  IMPLEMENTATION_REVIEW_SKILL_MD,
  INTAKE_SKILL_MD,
  MENTOR_RULES_MD,
  MENTOR_SESSION_SKILL_MD,
  PLAN_HEALTH_MD,
  PROGRESS_JSON,
  QUESTION_HISTORY_JSON,
  REVIEW_SKILL_MD,
  SHARED_RULES_MD,
  TEACHING_CYCLE_REFERENCE_MD,
} from "../templates/mentorFiles";

const DEFAULT_TOPICS: { label: string }[] = [
  { label: "HTML" },
  { label: "CSS" },
  { label: "JavaScript" },
  { label: "TypeScript" },
];

export async function copyCliArtifacts(
  distDir: string,
  targetToolsDir: string,
): Promise<void> {
  await fsp.mkdir(targetToolsDir, { recursive: true });
  await fsp.copyFile(
    join(distDir, "mentor-cli.js"),
    join(targetToolsDir, "mentor-cli.js"),
  );
  await fsp.copyFile(
    join(distDir, "sql-wasm.wasm"),
    join(targetToolsDir, "sql-wasm.wasm"),
  );
}

export async function cleanupLegacyTemplates(
  mentorSessionDir: string,
): Promise<boolean> {
  const legacyTrackerFormat = join(mentorSessionDir, "tracker-format.md");
  try {
    await fsp.unlink(legacyTrackerFormat);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

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

/**
 * Returns `true` if the folder is ours, `false` if it exists but is not ours,
 * or `null` if the folder does not exist.
 */
async function isMentorStudioFolder(
  mentorDirUri: vscode.Uri,
): Promise<boolean | null> {
  try {
    await vscode.workspace.fs.stat(mentorDirUri);
  } catch {
    return null; // folder doesn't exist — safe to create
  }

  // Folder exists — check if config.json has our signature field
  const configUri = vscode.Uri.joinPath(mentorDirUri, "config.json");
  try {
    const raw = await vscode.workspace.fs.readFile(configUri);
    const parsed = JSON.parse(Buffer.from(raw).toString()) as Record<
      string,
      unknown
    >;
    return "enableMentor" in parsed;
  } catch {
    return false; // no config.json or unparseable — not ours
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
  const mentorDirUri = vscode.Uri.joinPath(wsRoot, mentorFilesPath);

  // Check if .mentor folder already exists but is NOT ours
  const isOurFolder = await isMentorStudioFolder(mentorDirUri);
  if (isOurFolder === false) {
    const isJa = vscode.env.language.startsWith("ja");
    const overwrite = isJa
      ? "上書きする（この操作は元に戻せません）"
      : "Overwrite (this cannot be undone)";
    const answer = await vscode.window.showWarningMessage(
      isJa
        ? ".mentor フォルダが既に存在しますが、Mentor Studio Code のものではないようです。上書きしてもよいですか？"
        : "A .mentor folder already exists but does not appear to belong to Mentor Studio Code. Overwrite it?",
      { modal: true },
      overwrite,
    );
    if (answer !== overwrite) {
      return;
    }
  }

  const folderName =
    vscode.workspace.workspaceFolders?.[0]?.name ?? "my-project";

  // Ensure directories exist
  const rulesDirUri = vscode.Uri.joinPath(mentorDirUri, "rules");
  const toolsDirUri = vscode.Uri.joinPath(mentorDirUri, "tools");
  await vscode.workspace.fs.createDirectory(mentorDirUri);
  await vscode.workspace.fs.createDirectory(rulesDirUri);
  await vscode.workspace.fs.createDirectory(toolsDirUri);

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
    existingConfig.workspacePath = wsRoot.fsPath;
    existingConfig.enableMentor = true;
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
          mentorFiles: { spec: null },
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
  // Shared rules — at skills/ root
  const skillsDirUri = vscode.Uri.joinPath(mentorDirUri, "skills");
  await vscode.workspace.fs.createDirectory(skillsDirUri);
  await writeTemplate(
    vscode.Uri.joinPath(skillsDirUri, "shared-rules.md"),
    SHARED_RULES_MD,
    "skills/shared-rules.md",
  );

  // Teaching cycle reference — at skills/ root
  await writeTemplate(
    vscode.Uri.joinPath(skillsDirUri, "teaching-cycle-reference.md"),
    TEACHING_CYCLE_REFERENCE_MD,
    "skills/teaching-cycle-reference.md",
  );

  // Mentor session skill
  const mentorSessionDirUri = vscode.Uri.joinPath(
    skillsDirUri,
    "mentor-session",
  );
  await vscode.workspace.fs.createDirectory(mentorSessionDirUri);
  await writeTemplate(
    vscode.Uri.joinPath(mentorSessionDirUri, "SKILL.md"),
    MENTOR_SESSION_SKILL_MD,
    "skills/mentor-session/SKILL.md",
  );
  await writeTemplate(
    vscode.Uri.joinPath(mentorSessionDirUri, "plan-health.md"),
    PLAN_HEALTH_MD,
    "skills/mentor-session/plan-health.md",
  );
  // v0.5.0 shipped tracker-format.md; v0.6.0 dropped it. Remove if still on disk.
  if (await cleanupLegacyTemplates(mentorSessionDirUri.fsPath)) {
    outputChannel.appendLine(
      "Removed legacy skills/mentor-session/tracker-format.md",
    );
  }
  // Review skill
  const reviewDirUri = vscode.Uri.joinPath(skillsDirUri, "review");
  await vscode.workspace.fs.createDirectory(reviewDirUri);
  await writeTemplate(
    vscode.Uri.joinPath(reviewDirUri, "SKILL.md"),
    REVIEW_SKILL_MD,
    "skills/review/SKILL.md",
  );

  // Comprehension check skill
  const comprehensionDirUri = vscode.Uri.joinPath(
    skillsDirUri,
    "comprehension-check",
  );
  await vscode.workspace.fs.createDirectory(comprehensionDirUri);
  await writeTemplate(
    vscode.Uri.joinPath(comprehensionDirUri, "SKILL.md"),
    COMPREHENSION_CHECK_SKILL_MD,
    "skills/comprehension-check/SKILL.md",
  );

  // Implementation review skill
  const implReviewDirUri = vscode.Uri.joinPath(
    skillsDirUri,
    "implementation-review",
  );
  await vscode.workspace.fs.createDirectory(implReviewDirUri);
  await writeTemplate(
    vscode.Uri.joinPath(implReviewDirUri, "SKILL.md"),
    IMPLEMENTATION_REVIEW_SKILL_MD,
    "skills/implementation-review/SKILL.md",
  );

  // Intake skill
  const intakeDirUri = vscode.Uri.joinPath(skillsDirUri, "intake");
  await vscode.workspace.fs.createDirectory(intakeDirUri);
  await writeTemplate(
    vscode.Uri.joinPath(intakeDirUri, "SKILL.md"),
    INTAKE_SKILL_MD,
    "skills/intake/SKILL.md",
  );

  // CLI tool — always overwrite bundled mentor-cli.js and sql-wasm.wasm
  // so updates to the extension's bundled CLI take effect on setup.
  const distDir = vscode.Uri.joinPath(context.extensionUri, "dist").fsPath;
  await copyCliArtifacts(distDir, toolsDirUri.fsPath);
  createdFiles.push("tools/mentor-cli.js");
  createdFiles.push("tools/sql-wasm.wasm");

  // Bootstrap DB when data.db is missing (independent of config presence,
  // so re-running Setup after a manual DB deletion recreates the file).
  const dbPath = vscode.Uri.joinPath(mentorDirUri, "data.db").fsPath;
  const wasmPath = vscode.Uri.joinPath(toolsDirUri, "sql-wasm.wasm").fsPath;
  if (!existsSync(dbPath)) {
    await openDb(dbPath, { wasmPath, bootstrap: { topics: DEFAULT_TOPICS } });
    createdFiles.push("data.db");
  }

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
