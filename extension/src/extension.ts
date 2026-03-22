import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceRoot) {
    return;
  }

  // TODO: Task 6 — register file watcher
  // TODO: Task 7 — register sidebar provider
  // TODO: Task 11 — register setup command

  console.log("Mentor Studio activated");
}

export function deactivate(): void {
  // cleanup handled by disposables
}
