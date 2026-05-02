import { existsSync, promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import { openDb } from "../db";
import { acquireLock, releaseLock } from "../db/lock";
import { migrateToV3, shouldMigrateV3 } from "../migration/v3ExternalDb";
import {
  ensureCodexProjectEntrypoint,
  getEntrypointStatus,
  promptForClaudeMode,
  promptForSetupProviders,
  removeClaudePersonalEntrypoint,
  removeClaudeProjectEntrypoint,
  removeCodexProjectEntrypoint,
  setClaudeMode,
} from "../services/claudeMd";
import { derivePaths } from "../utils/derivePaths";
import { ensureWorkspaceId } from "../utils/workspaceId";
import {
  hasTrackedLegacyDbFiles,
  untrackLegacyDb,
} from "./untrackLegacyDb";
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
  REVIEW_SKILL_MD,
  SHARED_RULES_MD,
  TEACHING_CYCLE_REFERENCE_MD,
} from "../templates/mentorFiles";
import { MENTOR_GITIGNORE } from "../templates/mentorGitignore";

const DEFAULT_TOPICS: { label: string }[] = [
  { label: "HTML" },
  { label: "CSS" },
  { label: "JavaScript" },
  { label: "TypeScript" },
];

export interface EnsureExternalDbInput {
  workspaceRoot: string;
  configPath: string;
  wasmPath: string;
}

export interface EnsureExternalDbResult {
  workspaceId: string;
  dbPath: string;
  migratedFromLegacy: boolean;
  bootstrapped: boolean;
}

/**
 * Setup-time orchestration of v3 relocation + external DB bootstrap.
 *
 * 1. Ensure workspaceId in config.json (winner-takes-all across windows).
 * 2. If a legacy `.mentor/data.db` is still present, migrate it under the
 *    legacy-DB lock so two Setup invocations don't race on the file rename.
 *    An already-existing external DB is preserved (partial-failure recovery).
 * 3. If the external DB still doesn't exist after migration (fresh install),
 *    bootstrap an empty one with the default topics so the dashboard renders.
 *
 * Returns the resolved external dbPath and the workspaceId persisted in
 * config.json. Pure with respect to vscode.* — safe to unit-test.
 */
export async function ensureExternalDb(
  input: EnsureExternalDbInput,
): Promise<EnsureExternalDbResult> {
  const workspaceId = await ensureWorkspaceId(input.configPath);
  const paths = derivePaths({
    workspaceRoot: input.workspaceRoot,
    workspaceId,
  });

  let migratedFromLegacy = false;
  if (paths.externalDbPath && shouldMigrateV3(paths.legacyInWorkspaceDbPath)) {
    const lock = await acquireLock(paths.legacyInWorkspaceDbPath, {
      purpose: "migration",
      timeoutMs: 30_000,
    });
    try {
      // Re-check after acquiring the lock — another window may have finished.
      if (shouldMigrateV3(paths.legacyInWorkspaceDbPath)) {
        await migrateToV3(paths.legacyInWorkspaceDbPath, paths.externalDbPath);
        migratedFromLegacy = true;
      }
    } finally {
      await releaseLock(lock);
    }
  }

  let bootstrapped = false;
  if (!existsSync(paths.dbPath)) {
    // bootstrap acquires `<dbPath>.lock` via mkdir, which fails if the parent
    // `<workspaceId>/` doesn't exist yet (fresh install with no v3 migration).
    await fsp.mkdir(dirname(paths.dbPath), { recursive: true });
    await openDb(paths.dbPath, {
      wasmPath: input.wasmPath,
      bootstrap: { topics: DEFAULT_TOPICS },
    });
    bootstrapped = true;
  }

  return {
    workspaceId,
    dbPath: paths.dbPath,
    migratedFromLegacy,
    bootstrapped,
  };
}

export async function copyCliArtifacts(
  distDir: string,
  targetToolsDir: string,
): Promise<void> {
  await fsp.mkdir(targetToolsDir, { recursive: true });
  await fsp.copyFile(
    join(distDir, "mentor-cli.cjs"),
    join(targetToolsDir, "mentor-cli.cjs"),
  );
  // Remove legacy .js bundle left over from extensions ≤ 0.6.1.
  // Needed because host projects with `"type":"module"` in package.json
  // load `.js` as ESM, which breaks the CJS bundle.
  await fsp.rm(join(targetToolsDir, "mentor-cli.js"), { force: true });
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
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];

  await vscode.workspace.fs.createDirectory(mentorDirUri);
  // Drop a folder-level .gitignore so newly created data files are ignored
  // without forcing the user to edit their root .gitignore. Overwritten
  // every Setup run so future versions can update the contents.
  const mentorGitignoreUri = vscode.Uri.joinPath(mentorDirUri, ".gitignore");
  await vscode.workspace.fs.writeFile(
    mentorGitignoreUri,
    Buffer.from(MENTOR_GITIGNORE),
  );
  createdFiles.push(".mentor/.gitignore");
  await vscode.workspace.fs.createDirectory(rulesDirUri);
  await vscode.workspace.fs.createDirectory(toolsDirUri);

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

  // CLI tool — always overwrite bundled mentor-cli.cjs so updates to the
  // extension's bundled CLI take effect on setup. sql-wasm.wasm is now
  // inlined into mentor-cli.cjs, so nothing else ships to tools/.
  // The .cjs extension forces CommonJS loading regardless of the host
  // project's package.json "type" field.
  const distDir = vscode.Uri.joinPath(context.extensionUri, "dist").fsPath;
  await copyCliArtifacts(distDir, toolsDirUri.fsPath);
  createdFiles.push("tools/mentor-cli.cjs");

  // v3 relocation + DB bootstrap. Activation defers v3 to Setup, so the
  // legacy `.mentor/data.db` (if any) is migrated here under the existing
  // legacy-DB lock. B3 invariant: dbPath returned is ALWAYS the external one.
  const wasmPath = vscode.Uri.joinPath(
    context.extensionUri,
    "dist",
    "sql-wasm.wasm",
  ).fsPath;
  const dbResult = await ensureExternalDb({
    workspaceRoot: wsRoot.fsPath,
    configPath: vscode.Uri.joinPath(mentorDirUri, "config.json").fsPath,
    wasmPath,
  });
  if (dbResult.migratedFromLegacy) {
    createdFiles.push("data.db (migrated from .mentor/data.db)");
  }
  if (dbResult.bootstrapped) {
    createdFiles.push("data.db (external storage)");
  }

  // Data files — only write if missing
  await writeDataIfMissing(
    vscode.Uri.joinPath(mentorDirUri, "current-task.md"),
    CURRENT_TASK_MD,
    "current-task.md",
  );

  const isJa = existingConfig
    ? existingConfig.locale !== "en"
    : detectedLocale === "ja";

  const currentEntrypoints = await getEntrypointStatus(wsRoot);
  let claudeAction = "kept existing Claude entrypoints";
  let codexAction = "kept existing Codex entrypoint";
  const providerSelection = await promptForSetupProviders(isJa);

  if (providerSelection) {
    if (providerSelection.claude) {
      const claudeMode =
        (await promptForClaudeMode(isJa)) ?? currentEntrypoints.claudeMode;
      if (claudeMode) {
        await setClaudeMode(wsRoot, claudeMode);
        claudeAction =
          claudeMode === "project"
            ? "added to project CLAUDE.md"
            : "added to personal CLAUDE.md";
      } else {
        claudeAction = "skipped by user";
      }
    } else {
      await Promise.all([
        removeClaudeProjectEntrypoint(wsRoot),
        removeClaudePersonalEntrypoint(wsRoot),
      ]);
      claudeAction = "removed from Claude entrypoints";
    }

    if (providerSelection.codex) {
      await ensureCodexProjectEntrypoint(wsRoot);
      codexAction = "added to project AGENTS.md";
    } else {
      await removeCodexProjectEntrypoint(wsRoot);
      codexAction = "removed from project AGENTS.md";
    }
  } else {
    claudeAction = "skipped by user";
    codexAction = "skipped by user";
  }

  // Output results
  outputChannel.appendLine("=== Mentor Studio Code Setup Results ===");
  outputChannel.appendLine(
    `Created: ${createdFiles.join(", ") || "none (all existed)"}`,
  );
  outputChannel.appendLine(`Skipped: ${skippedFiles.join(", ") || "none"}`);
  outputChannel.appendLine(`Claude Code: ${claudeAction}`);
  outputChannel.appendLine(`Codex: ${codexAction}`);
  outputChannel.show(true);

  // Untrack legacy DB from git if it's still indexed. v0.6.6 moved the DB
  // outside the workspace, so any leftover `.mentor/data.db*` in the index
  // produces phantom diffs on every commit. Surfacing this right after Setup
  // is the natural moment — migration just ran here.
  try {
    if (await hasTrackedLegacyDbFiles(wsRoot.fsPath)) {
      const accept = isJa ? "Untrack する" : "Untrack";
      const dismiss = isJa ? "あとで" : "Later";
      const message = isJa
        ? ".mentor/data.db が git で追跡されています。Mentor は v0.6.6 で DB をワークスペース外に移動したため、git の追跡を外しておくと `git pull` などとの衝突を防げます。untrack しますか？(.mentor/.gitignore も自動で stage されるので、`git commit` 1 回で完結します。)"
        : "`.mentor/data.db` is tracked in git. Mentor moved the DB outside the workspace in v0.6.6 — untracking the legacy file prevents future `git pull` conflicts. Untrack now? (We'll also stage `.mentor/.gitignore` so a single `git commit` finalizes the cleanup.)";
      const choice = await vscode.window.showInformationMessage(
        message,
        accept,
        dismiss,
      );
      if (choice === accept) {
        await untrackLegacyDb(wsRoot.fsPath);
        void vscode.window.showInformationMessage(
          isJa
            ? "git の追跡を外しました。次回の `git commit` で確定されます。例: `git commit -m \"Untrack legacy mentor DB\"`"
            : "Untracked from git. Run a `git commit` to finalize — e.g. `git commit -m \"Untrack legacy mentor DB\"`.",
        );
      }
    }
  } catch (err) {
    outputChannel.appendLine(
      `untrack-legacy-db notification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

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
