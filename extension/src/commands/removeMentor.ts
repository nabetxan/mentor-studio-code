import type { CleanupOptions } from "@mentor-studio/shared";
import { existsSync, promises as fsp } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import * as vscode from "vscode";
import { getEntrypointStatus, removeMentorRef } from "../services/claudeMd";
import { parseConfig } from "../services/dataParser";
import {
  getExternalDataDir,
  getExternalDataDirForWorkspace,
  InvalidWorkspaceIdError,
} from "../utils/dataPath";
import { resolveLocale } from "../utils/locale";
import { isValidWorkspaceId } from "../utils/workspaceId";

function isWithinRoot(target: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Recursively delete the given directory if it exists.
 * Returns true if the directory existed and was removed, false if it was already absent.
 *
 * Pure helper — accepts a path, performs no platform branching. Tests can supply
 * a tmpdir-rooted path so they don't pollute the user's real data dir.
 */
export async function wipeExternalDataDirAt(
  dir: string,
  allowedRoot: string,
): Promise<boolean> {
  if (!isWithinRoot(dir, allowedRoot)) {
    throw new Error(`Refusing to delete outside managed data root: ${dir}`);
  }
  if (!existsSync(dir)) return false;
  await fsp.rm(dir, { recursive: true, force: true });
  return true;
}

/**
 * Compute the external data directory for the given workspaceId and recursively
 * delete it. Wrapper around `wipeExternalDataDirAt` that resolves the platform-
 * specific path.
 */
export async function wipeExternalDataDirForWorkspace(
  workspaceId: string,
): Promise<boolean> {
  if (!isValidWorkspaceId(workspaceId)) {
    throw new InvalidWorkspaceIdError(workspaceId);
  }
  const root = getExternalDataDir();
  const dir = getExternalDataDirForWorkspace(workspaceId);
  return wipeExternalDataDirAt(dir, root);
}

export async function cleanupRuntimeArtifacts(
  mentorDirPath: string,
): Promise<void> {
  const targets: { path: string; kind: "file" | "dir" }[] = [
    { path: "data.db", kind: "file" },
    { path: "data.db.lock", kind: "dir" },
    { path: "data.db.bak", kind: "file" },
    { path: "sql-wasm.wasm", kind: "file" },
    { path: "tools/mentor-cli.cjs", kind: "file" },
    { path: "tools/mentor-cli.js", kind: "file" },
    { path: "tools/sql-wasm.wasm", kind: "file" },
  ];
  for (const t of targets) {
    const target = join(mentorDirPath, t.path);
    try {
      if (t.kind === "dir") {
        await fsp.rm(target, { recursive: true, force: true });
      } else {
        await fsp.rm(target, { force: true });
      }
    } catch {
      // idempotent: ignore missing/inaccessible
    }
  }
}

export async function runRemoveMentor(
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  const isJa = wsRoot
    ? (await resolveLocale(wsRoot.fsPath)) === "ja"
    : vscode.env.language.startsWith("ja");

  if (!wsRoot) {
    vscode.window.showErrorMessage(
      isJa ? "先にフォルダを開いてください。" : "Open a folder first.",
    );
    return;
  }

  // Confirmation dialog
  const confirmLabel = isJa ? "実行する" : "Continue";
  const choice = await vscode.window.showWarningMessage(
    isJa
      ? "設定済みの AI エントリポイントからメンター参照を削除し、メンターを無効化します。.mentor フォルダ（学習履歴含む）は削除されません。よろしいですか？"
      : "This will remove mentor references from configured AI entrypoint files and disable Mentor. The .mentor folder (including learning history) will not be deleted. Continue?",
    { modal: true },
    confirmLabel,
  );

  if (choice !== confirmLabel) {
    return;
  }

  // Check if ref exists before removing
  const refStatus = await getEntrypointStatus(wsRoot);
  const hadRef = refStatus.anyEntrypoint;

  // Remove mentor entrypoints from all supported AI entrypoint files.
  await removeMentorRef(wsRoot);

  // Clean up SQLite-era runtime artifacts (idempotent; leaves user-owned files alone)
  await cleanupRuntimeArtifacts(join(wsRoot.fsPath, ".mentor"));
  outputChannel.appendLine("Cleaned up SQLite runtime artifacts");

  // Update config.json: enableMentor=false, remove extensionUninstalled
  {
    const configUri = vscode.Uri.joinPath(wsRoot, ".mentor", "config.json");
    try {
      const raw = await vscode.workspace.fs.readFile(configUri);
      const rawText = Buffer.from(raw).toString();
      const parsed = parseConfig(rawText);
      if (parsed) {
        const rawObj = JSON.parse(rawText) as Record<string, unknown>;
        rawObj.enableMentor = false;
        delete rawObj.extensionUninstalled;
        await vscode.workspace.fs.writeFile(
          configUri,
          Buffer.from(JSON.stringify(rawObj, null, 2) + "\n"),
        );
        outputChannel.appendLine("Set enableMentor: false");
      } else {
        outputChannel.appendLine(
          "Remove Mentor: config.json has invalid format, skipping config update",
        );
      }
    } catch {
      // config.json doesn't exist — skip config update
      outputChannel.appendLine(
        "Remove Mentor: .mentor/config.json not found, skipping config update",
      );
    }
  }

  // Result notification
  if (hadRef) {
    vscode.window.showInformationMessage(
      isJa
        ? "メンター参照を削除しました。"
        : "Mentor references have been removed.",
    );
  } else {
    vscode.window.showInformationMessage(
      isJa
        ? "AI エントリポイントにメンター参照が見つかりませんでした。メンターを無効化しました。"
        : "No mentor references were found in AI entrypoint files. Mentor has been disabled.",
    );
  }

  outputChannel.appendLine("=== Remove Mentor ===");
  outputChannel.appendLine(
    hadRef
      ? "Removed mentor references from AI entrypoint files"
      : "No mentor references found in AI entrypoint files",
  );
}

export async function runCleanupMentor(
  options: CleanupOptions,
  outputChannel: vscode.OutputChannel,
  globalState: vscode.Memento,
  postResult: (deleted: CleanupOptions, isJa: boolean) => void,
  onMentorFolderDeleted?: () => void | Promise<void>,
): Promise<void> {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  if (!wsRoot) {
    return;
  }

  const isJa = (await resolveLocale(wsRoot.fsPath)) === "ja";

  // Confirm before destructive deletion. The DB now lives outside .mentor, so
  // only the external-DB checkbox actually wipes learning history.
  if (options.mentorFolder || options.wipeExternalDb) {
    const confirmLabel = isJa ? "削除する" : "Delete";
    let promptMessage: string;
    if (options.wipeExternalDb) {
      promptMessage = isJa
        ? "削除すると復元できません。学習データが失われます。よろしいですか？"
        : "This cannot be undone. Your learning history will be lost. Continue?";
    } else {
      promptMessage = isJa
        ? "削除すると復元できません。よろしいですか？"
        : "This cannot be undone. Continue?";
    }
    const choice = await vscode.window.showWarningMessage(
      promptMessage,
      { modal: true },
      confirmLabel,
    );
    if (choice !== confirmLabel) {
      postResult(
        {
          mentorFolder: false,
          profile: false,
          claudeMdRef: false,
          wipeExternalDb: false,
        },
        isJa,
      );
      return;
    }
  }

  // Read workspaceId from config.json BEFORE the .mentor folder is potentially
  // deleted — needed later to locate the external data dir.
  let cachedWorkspaceId: string | null = null;
  try {
    const configUri = vscode.Uri.joinPath(wsRoot, ".mentor", "config.json");
    const raw = await vscode.workspace.fs.readFile(configUri);
    const obj = JSON.parse(Buffer.from(raw).toString()) as Record<
      string,
      unknown
    >;
    if (
      typeof obj.workspaceId === "string" &&
      obj.workspaceId.length > 0 &&
      isValidWorkspaceId(obj.workspaceId)
    ) {
      cachedWorkspaceId = obj.workspaceId;
    }
  } catch {
    // config not readable — leave cachedWorkspaceId null
  }

  const deleted: CleanupOptions = {
    mentorFolder: false,
    profile: false,
    claudeMdRef: false,
    wipeExternalDb: false,
  };

  outputChannel.appendLine("=== Cleanup Mentor ===");

  // 1. Delete .mentor folder
  if (options.mentorFolder) {
    const mentorUri = vscode.Uri.joinPath(wsRoot, ".mentor");
    try {
      await vscode.workspace.fs.delete(mentorUri, { recursive: true });
      deleted.mentorFolder = true;
      outputChannel.appendLine("Deleted .mentor folder");
    } catch {
      outputChannel.appendLine(
        ".mentor folder not found or could not be deleted",
      );
    }
    // FileSystemWatcher's onDidDelete for .mentor/config.json is unreliable
    // after a recursive parent-dir delete (macOS fsevents). Signal the sidebar
    // explicitly so it flips to the noConfig / "Run Setup" view.
    if (deleted.mentorFolder && onMentorFolderDeleted) {
      try {
        await onMentorFolderDeleted();
      } catch (err) {
        outputChannel.appendLine(
          `onMentorFolderDeleted hook failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // 2. Clear profile from globalState
  if (options.profile) {
    await globalState.update("learnerProfile", undefined);
    deleted.profile = true;
    outputChannel.appendLine("Cleared learnerProfile from globalState");
  }

  // 3. Remove CLAUDE.md reference
  if (options.claudeMdRef) {
    const refStatus = await getEntrypointStatus(wsRoot);
    const hadRef = refStatus.anyEntrypoint;
    await removeMentorRef(wsRoot);
    deleted.claudeMdRef = hadRef;
    outputChannel.appendLine(
      hadRef
        ? "Removed mentor references from AI entrypoint files"
        : "No mentor references found in AI entrypoint files",
    );
  }

  // 4. Wipe external workspace data dir (DB lives outside the workspace)
  if (options.wipeExternalDb && cachedWorkspaceId) {
    try {
      const removed =
        await wipeExternalDataDirForWorkspace(cachedWorkspaceId);
      if (removed) {
        deleted.wipeExternalDb = true;
        outputChannel.appendLine(
          `Removed external DB dir for workspaceId: ${cachedWorkspaceId}`,
        );
      } else {
        outputChannel.appendLine(
          `External DB dir not found for workspaceId: ${cachedWorkspaceId}`,
        );
      }
    } catch (err) {
      outputChannel.appendLine(
        `Failed to remove external DB dir: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else if (options.wipeExternalDb) {
    outputChannel.appendLine(
      "Skipped external DB deletion: config.json has no valid workspaceId",
    );
  }

  // Update config.json if it still exists (mentor folder not deleted)
  if (!options.mentorFolder) {
    const configUri = vscode.Uri.joinPath(wsRoot, ".mentor", "config.json");
    try {
      const raw = await vscode.workspace.fs.readFile(configUri);
      const rawText = Buffer.from(raw).toString();
      const parsed = parseConfig(rawText);
      if (parsed) {
        const rawObj = JSON.parse(rawText) as Record<string, unknown>;
        rawObj.enableMentor = false;
        delete rawObj.extensionUninstalled;
        await vscode.workspace.fs.writeFile(
          configUri,
          Buffer.from(JSON.stringify(rawObj, null, 2) + "\n"),
        );
        outputChannel.appendLine("Set enableMentor: false in config.json");
      } else {
        outputChannel.appendLine(
          "Cleanup: config.json has invalid format, skipping config update",
        );
      }
    } catch {
      // config.json doesn't exist — skip
    }
  }

  postResult(deleted, isJa);
}
