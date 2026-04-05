import type {
  DashboardData,
  ExtensionMessage,
  FileField,
  Locale,
  MentorStudioConfig,
  WebviewMessage,
} from "@mentor-studio/shared";
import * as path from "node:path";
import * as vscode from "vscode";
import { findMentorRef, promptAndAddMentorRef } from "../services/claudeMd";
import { parseConfig } from "../services/dataParser";
import { getNonce } from "../utils/nonce";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private latestData: DashboardData | null = null;
  private latestConfig: MentorStudioConfig | null = null;
  private hasConfig = true;
  private onMergeTopic?: (fromKey: string, toKey: string) => Promise<void>;
  private onUpdateTopicLabel?: (key: string, newLabel: string) => Promise<void>;
  private onAddTopic?: (
    label: string,
  ) => Promise<{ ok: boolean; key?: string; error?: string }>;
  private onDeleteTopics?: (
    keys: string[],
  ) => Promise<{ key: string; ok: boolean; error?: string }[]>;

  constructor(private extensionUri: vscode.Uri) {}

  setTopicHandlers(handlers: {
    mergeTopic: (fromKey: string, toKey: string) => Promise<void>;
    updateTopicLabel: (key: string, newLabel: string) => Promise<void>;
    addTopic: (
      label: string,
    ) => Promise<{ ok: boolean; key?: string; error?: string }>;
    deleteTopics: (
      keys: string[],
    ) => Promise<{ key: string; ok: boolean; error?: string }[]>;
  }): void {
    this.onMergeTopic = handlers.mergeTopic;
    this.onUpdateTopicLabel = handlers.updateTopicLabel;
    this.onAddTopic = handlers.addTopic;
    this.onDeleteTopics = handlers.deleteTopics;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webview", "dist"),
      ],
    };

    webviewView.webview.html = this.getHtml(
      webviewView.webview,
      this.latestConfig?.locale ?? "ja",
    );

    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (message.type === "ready") {
          this.flushState();
        } else if (message.type === "copy") {
          try {
            await vscode.env.clipboard.writeText(message.text);
          } catch {
            vscode.window.showErrorMessage(
              this.isJa
                ? "クリップボードへのコピーに失敗しました"
                : "Failed to copy to clipboard",
            );
          }
        } else if (message.type === "selectFile") {
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { Markdown: ["md"] },
            openLabel: "Select File",
          });
          if (uris && uris.length > 0) {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!wsRoot) {
              return;
            }
            const selectedPath = uris[0].fsPath;
            const wsPath = wsRoot.fsPath;
            const relativePath = path.relative(wsPath, selectedPath);
            if (
              path.isAbsolute(relativePath) ||
              relativePath.startsWith("..")
            ) {
              vscode.window.showErrorMessage(
                this.isJa
                  ? "ワークスペース内のファイルを選択してください。"
                  : "File must be inside the workspace.",
              );
              return;
            }
            await this.updateMentorFile(message.field, relativePath);
          }
        } else if (message.type === "clearFile") {
          await this.updateMentorFile(message.field, null);
        } else if (message.type === "runSetup") {
          await vscode.commands.executeCommand("mentor-studio.setup");
        } else if (message.type === "setLocale") {
          await this.updateLocale(message.locale);
        } else if (message.type === "setEnableMentor") {
          await this.updateEnableMentor(message.value);
        } else if (message.type === "mergeTopic") {
          try {
            await this.onMergeTopic?.(message.fromKey, message.toKey);
          } catch {
            vscode.window.showErrorMessage(
              this.isJa
                ? "トピックの統合に失敗しました"
                : "Failed to merge topic",
            );
          }
        } else if (message.type === "updateTopicLabel") {
          try {
            await this.onUpdateTopicLabel?.(message.key, message.newLabel);
          } catch {
            vscode.window.showErrorMessage(
              this.isJa
                ? "トピック名の更新に失敗しました"
                : "Failed to update topic label",
            );
          }
        } else if (message.type === "openFile") {
          const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
          if (wsRoot) {
            const fileUri = vscode.Uri.joinPath(wsRoot, message.relativePath);
            try {
              await vscode.window.showTextDocument(fileUri, { preview: true });
            } catch {
              vscode.window.showErrorMessage(
                this.isJa
                  ? `ファイルを開けませんでした: ${message.relativePath}`
                  : `Failed to open file: ${message.relativePath}`,
              );
            }
          }
        } else if (message.type === "addTopic") {
          try {
            const result = (await this.onAddTopic?.(message.label)) ?? {
              ok: false,
              error: "No handler",
            };
            this.postMessage({ type: "addTopicResult", ...result });
          } catch {
            this.postMessage({
              type: "addTopicResult",
              ok: false,
              error: "Failed to add topic",
            });
          }
        } else if (message.type === "deleteTopics") {
          try {
            const results = (await this.onDeleteTopics?.(message.keys)) ?? [];
            this.postMessage({ type: "deleteTopicsResult", results });
          } catch {
            const results = message.keys.map((key) => ({
              key,
              ok: false,
              error: "delete_failed",
            }));
            this.postMessage({ type: "deleteTopicsResult", results });
          }
        } else if (message.type === "removeMentor") {
          await vscode.commands.executeCommand("mentor-studio.removeMentor");
        }
      },
    );

    webviewView.onDidDispose(() => {
      messageDisposable.dispose();
    });
  }

  sendUpdate(data: DashboardData): void {
    this.latestData = data;
    this.postMessage({ type: "update", data });
  }

  sendConfig(config: MentorStudioConfig): void {
    this.latestConfig = config;
    this.hasConfig = true;
    this.postMessage({ type: "config", data: config });
  }

  sendNoConfig(): void {
    this.hasConfig = false;
    this.postMessage({ type: "noConfig", locale: this.detectLocale() });
  }

  private detectLocale(): Locale {
    return vscode.env.language.startsWith("ja") ? "ja" : "en";
  }

  private get isJa(): boolean {
    return (this.latestConfig?.locale ?? this.detectLocale()) !== "en";
  }

  private flushState(): void {
    if (!this.hasConfig) {
      this.postMessage({ type: "noConfig", locale: this.detectLocale() });
      return;
    }
    if (this.latestConfig) {
      this.postMessage({ type: "config", data: this.latestConfig });
    }
    if (this.latestData) {
      this.postMessage({ type: "update", data: this.latestData });
    }
  }

  private async updateConfig(
    mutate: (config: MentorStudioConfig) => void,
  ): Promise<void> {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!wsRoot) {
      return;
    }
    const configUri = vscode.Uri.joinPath(wsRoot, ".mentor", "config.json");
    try {
      const raw = await vscode.workspace.fs.readFile(configUri);
      const rawText = Buffer.from(raw).toString();
      const parsed = parseConfig(rawText);
      if (!parsed) {
        vscode.window.showErrorMessage(
          this.isJa
            ? ".mentor/config.json の形式が不正です"
            : ".mentor/config.json has invalid format",
        );
        return;
      }
      // Preserve unknown fields by merging typed changes into raw JSON
      const rawObj = JSON.parse(rawText) as Record<string, unknown>;
      mutate(parsed);
      Object.assign(rawObj, parsed);
      await vscode.workspace.fs.writeFile(
        configUri,
        Buffer.from(JSON.stringify(rawObj, null, 2) + "\n"),
      );
      this.latestConfig = parsed;
      this.postMessage({ type: "config", data: parsed });
    } catch {
      vscode.window.showErrorMessage(
        this.isJa
          ? ".mentor/config.json の更新に失敗しました"
          : "Failed to update .mentor/config.json",
      );
    }
  }

  private async updateLocale(locale: Locale): Promise<void> {
    await this.updateConfig((config) => {
      config.locale = locale;
    });
  }

  private async updateEnableMentor(value: boolean): Promise<void> {
    if (!value) {
      // Toggling OFF — just update config
      await this.updateConfig((config) => {
        config.enableMentor = false;
      });
      return;
    }

    // Toggling ON — check if @ref exists in CLAUDE.md
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!wsRoot) {
      return;
    }

    const status = await findMentorRef(wsRoot);

    if (status.personal || status.project) {
      // Ref exists — just toggle ON
      await this.updateConfig((config) => {
        config.enableMentor = true;
      });
      return;
    }

    // Ref missing — prompt user to add it
    const result = await promptAndAddMentorRef(wsRoot, this.isJa);

    if (result === undefined) {
      // User cancelled — keep enableMentor false
      vscode.window.showInformationMessage(
        this.isJa
          ? "メンター参照が CLAUDE.md にないため、有効化できません。"
          : "Cannot enable: mentor reference is missing from CLAUDE.md.",
      );
      // Re-send config to reset the toggle in the webview
      if (this.latestConfig) {
        this.postMessage({ type: "config", data: this.latestConfig });
      }
      return;
    }

    // Ref added — now toggle ON
    await this.updateConfig((config) => {
      config.enableMentor = true;
    });
  }

  private async updateMentorFile(
    field: FileField,
    value: string | null,
  ): Promise<void> {
    await this.updateConfig((config) => {
      const mentorFiles = config.mentorFiles ?? {
        spec: null,
        plan: null,
      };
      mentorFiles[field] = value;
      config.mentorFiles = mentorFiles;
    });
  }

  private postMessage(message: ExtensionMessage): void {
    this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview, locale: Locale = "ja"): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "webview.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "webview.css"),
    );
    const nonce = getNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
