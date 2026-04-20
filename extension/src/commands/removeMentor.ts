import type { CleanupOptions } from "@mentor-studio/shared";
import { promises as fsp } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { findMentorRef, removeMentorRef } from "../services/claudeMd";
import { parseConfig } from "../services/dataParser";

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

async function readIsJaFromConfig(wsRoot: vscode.Uri): Promise<boolean> {
  try {
    const configUri = vscode.Uri.joinPath(wsRoot, ".mentor", "config.json");
    const raw = await vscode.workspace.fs.readFile(configUri);
    const parsed = parseConfig(Buffer.from(raw).toString());
    if (parsed?.locale) {
      return parsed.locale !== "en";
    }
  } catch {
    // config not readable — use system locale
  }
  return vscode.env.language.startsWith("ja");
}

export async function runRemoveMentor(
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  const isJa = wsRoot
    ? await readIsJaFromConfig(wsRoot)
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
      ? "CLAUDE.md からメンター参照を削除し、メンターを無効化します。.mentor フォルダ（学習履歴含む）は削除されません。よろしいですか？"
      : "This will remove the mentor reference from CLAUDE.md and disable the mentor. The .mentor folder (including learning history) will not be deleted. Continue?",
    { modal: true },
    confirmLabel,
  );

  if (choice !== confirmLabel) {
    return;
  }

  // Check if ref exists before removing
  const refStatus = await findMentorRef(wsRoot);
  const hadRef = refStatus.personal || refStatus.project;

  // Remove @ref from both CLAUDE.md locations
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
        : "Mentor reference has been removed.",
    );
  } else {
    vscode.window.showInformationMessage(
      isJa
        ? "CLAUDE.md にメンター参照が見つかりませんでした。メンターを無効化しました。"
        : "No mentor reference found in CLAUDE.md. Mentor has been disabled.",
    );
  }

  outputChannel.appendLine("=== Remove Mentor ===");
  outputChannel.appendLine(
    hadRef
      ? "Removed mentor reference from CLAUDE.md"
      : "No mentor reference found in CLAUDE.md",
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

  const isJa = await readIsJaFromConfig(wsRoot);

  // Confirm before destructive .mentor folder deletion
  if (options.mentorFolder) {
    const confirmLabel = isJa ? "削除する" : "Delete";
    const choice = await vscode.window.showWarningMessage(
      isJa
        ? ".mentor フォルダを削除すると学習履歴を含むすべてのデータが消去されます。よろしいですか？"
        : "Deleting the .mentor folder will erase all data including learning history. Continue?",
      { modal: true },
      confirmLabel,
    );
    if (choice !== confirmLabel) {
      postResult(
        { mentorFolder: false, profile: false, claudeMdRef: false },
        isJa,
      );
      return;
    }
  }

  const deleted: CleanupOptions = {
    mentorFolder: false,
    profile: false,
    claudeMdRef: false,
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
    const refStatus = await findMentorRef(wsRoot);
    const hadRef = refStatus.personal || refStatus.project;
    await removeMentorRef(wsRoot);
    deleted.claudeMdRef = hadRef;
    outputChannel.appendLine(
      hadRef
        ? "Removed mentor reference from CLAUDE.md"
        : "No mentor reference found in CLAUDE.md",
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
