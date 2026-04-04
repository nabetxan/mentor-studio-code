import * as vscode from "vscode";
import { findMentorRef, removeMentorRef } from "../services/claudeMd";

export async function runRemoveMentor(
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const isJa = vscode.env.language.startsWith("ja");

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

  // Update config.json: enableMentor=false, remove extensionUninstalled
  {
    const configUri = vscode.Uri.joinPath(wsRoot, ".mentor", "config.json");
    try {
      const raw = await vscode.workspace.fs.readFile(configUri);
      const rawText = Buffer.from(raw).toString();
      const rawObj = JSON.parse(rawText) as Record<string, unknown>;
      rawObj.enableMentor = false;
      delete rawObj.extensionUninstalled;
      await vscode.workspace.fs.writeFile(
        configUri,
        Buffer.from(JSON.stringify(rawObj, null, 2) + "\n"),
      );
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
  outputChannel.appendLine("Set enableMentor: false");
}
