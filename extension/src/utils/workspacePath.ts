import * as vscode from "vscode";

export function toWorkspaceRelative(
  uri: vscode.Uri,
  isJa: boolean,
): string | null {
  if (!vscode.workspace.getWorkspaceFolder(uri)) {
    vscode.window.showErrorMessage(
      isJa
        ? "ワークスペース内のファイルを選択してください。"
        : "File must be inside the workspace.",
    );
    return null;
  }
  return vscode.workspace.asRelativePath(uri, false);
}
