import type {
  DashboardData,
  ExtensionMessage,
  MentorStudioConfig,
  WebviewMessage,
} from "@mentor-studio/shared";
import * as vscode from "vscode";
import { getNonce } from "../utils/nonce";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private latestData: DashboardData | null = null;
  private latestConfig: MentorStudioConfig | null = null;
  private hasConfig = true;

  constructor(private extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webview", "dist"),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.type === "ready") {
        this.flushState();
      } else if (message.type === "copy") {
        try {
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage("Copied to clipboard");
        } catch {
          vscode.window.showErrorMessage("Failed to copy to clipboard");
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
          if (!selectedPath.startsWith(wsPath)) {
            vscode.window.showErrorMessage(
              "File must be inside the workspace.",
            );
            return;
          }
          const relativePath = selectedPath
            .slice(wsPath.length)
            .replace(/^[/\\]/, "");
          await this.updateMentorFile(message.field, relativePath);
        }
      } else if (message.type === "clearFile") {
        await this.updateMentorFile(message.field, null);
      }
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
    this.postMessage({ type: "noConfig" });
  }

  private flushState(): void {
    if (!this.hasConfig) {
      this.postMessage({ type: "noConfig" });
      return;
    }
    if (this.latestConfig) {
      this.postMessage({ type: "config", data: this.latestConfig });
    }
    if (this.latestData) {
      this.postMessage({ type: "update", data: this.latestData });
    }
  }

  private async updateMentorFile(
    field: "appDesign" | "roadmap",
    value: string | null,
  ): Promise<void> {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!wsRoot) {
      return;
    }

    const configUri = vscode.Uri.joinPath(wsRoot, ".mentor-studio.json");
    try {
      const raw = await vscode.workspace.fs.readFile(configUri);
      const config = JSON.parse(
        Buffer.from(raw).toString(),
      ) as MentorStudioConfig;
      const mentorFiles = config.mentorFiles ?? {
        appDesign: null,
        roadmap: null,
      };
      mentorFiles[field] = value;
      config.mentorFiles = mentorFiles;
      await vscode.workspace.fs.writeFile(
        configUri,
        Buffer.from(JSON.stringify(config, null, 2) + "\n"),
      );

      this.latestConfig = config;
      this.postMessage({ type: "config", data: config });
    } catch (err) {
      console.error("Failed to update .mentor-studio.json", err);
    }
  }

  private postMessage(message: ExtensionMessage): void {
    this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "webview.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "webview.css"),
    );
    const nonce = getNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
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
