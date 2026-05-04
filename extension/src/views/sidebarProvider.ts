import type {
  CleanupOptions,
  DashboardData,
  ExtensionMessage,
  FileField,
  Locale,
  MentorEntrypointFileStatus,
  MentorStudioConfig,
  WebviewMessage,
} from "@mentor-studio/shared";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  ensureProjectAgentsMdEntrypoint,
  getEntrypointStatus,
  removePersonalClaudeMdEntrypoint,
  removeProjectAgentsMdEntrypoint,
  removeProjectClaudeMdEntrypoint,
  setClaudeMdScope as setClaudeMdScopeOnDisk,
} from "../services/claudeMd";
import { parseConfig } from "../services/dataParser";
import { derivePaths } from "../utils/derivePaths";
import { getNonce } from "../utils/nonce";
import { toWorkspaceRelative } from "../utils/workspacePath";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private latestData: DashboardData | null = null;
  private latestConfig: MentorStudioConfig | null = null;
  private hasConfig = true;
  private needsMigration = false;
  private onMergeTopic?: (fromKey: string, toKey: string) => Promise<void>;
  private onUpdateTopicLabel?: (key: string, newLabel: string) => Promise<void>;
  private onAddTopic?: (
    label: string,
  ) => Promise<{ ok: boolean; key?: string; error?: string }>;
  private onDeleteTopics?: (
    keys: string[],
  ) => Promise<{ key: string; ok: boolean; error?: string }[]>;
  private onActivatePlan?: (id: number) => Promise<void>;
  private onDeactivatePlan?: (id: number) => Promise<void>;
  private onPauseActivePlan?: (id: number) => Promise<void>;
  private onChangeActivePlanFile?: (relPath: string) => Promise<void>;
  private onCreateAndActivatePlan?: (relPath: string) => Promise<void>;

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

  setPlanHandlers(handlers: {
    activatePlan: (id: number) => Promise<void>;
    deactivatePlan: (id: number) => Promise<void>;
    pauseActivePlan: (id: number) => Promise<void>;
    changeActivePlanFile: (relPath: string) => Promise<void>;
    createAndActivatePlan: (relPath: string) => Promise<void>;
  }): void {
    this.onActivatePlan = handlers.activatePlan;
    this.onDeactivatePlan = handlers.deactivatePlan;
    this.onPauseActivePlan = handlers.pauseActivePlan;
    this.onChangeActivePlanFile = handlers.changeActivePlanFile;
    this.onCreateAndActivatePlan = handlers.createAndActivatePlan;
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
      this.latestConfig?.locale ?? this.detectLocale(),
    );

    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (message.type === "ready") {
          await this.flushState();
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
          if (message.field === "plan") {
            // Sidebar sets the one active plan, so create + activate in one
            // step. Plan Panel's createPlan is separate on purpose — it
            // manages multiple plans and must not auto-activate.
            const uris = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectMany: false,
              filters: { Markdown: ["md"] },
            });
            if (!uris || uris.length === 0) return;
            const relPath = toWorkspaceRelative(uris[0], this.isJa);
            if (relPath === null) return;
            try {
              await this.onCreateAndActivatePlan?.(relPath);
            } catch (err) {
              vscode.window.showErrorMessage(
                this.isJa
                  ? `プランの作成に失敗しました: ${err instanceof Error ? err.message : String(err)}`
                  : `Failed to create plan: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          } else {
            // Legacy spec flow: write to config.json
            const uris = await vscode.window.showOpenDialog({
              canSelectMany: false,
              filters: { Markdown: ["md"] },
              openLabel: "Select File",
            });
            if (!uris || uris.length === 0) return;
            const relPath = toWorkspaceRelative(uris[0], this.isJa);
            if (relPath === null) return;
            await this.updateMentorFile(message.field, relPath);
          }
        } else if (message.type === "clearFile") {
          await this.updateMentorFile(message.field, null);
        } else if (message.type === "runSetup") {
          await vscode.commands.executeCommand("mentor-studio.setup", {
            source: message.source ?? "sidebarNoConfig",
          });
        } else if (message.type === "setLocale") {
          await this.updateLocale(message.locale);
        } else if (message.type === "setEnableMentor") {
          await this.updateEnableMentor(message.value);
        } else if (message.type === "setClaudeMdEnabled") {
          await this.setClaudeMdEnabled(message.value);
        } else if (message.type === "setClaudeMdScope") {
          await this.setClaudeMdScope(message.value);
        } else if (message.type === "setAgentsMdEnabled") {
          await this.setAgentsMdEnabled(message.value);
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
          const fileUri = path.isAbsolute(message.relativePath)
            ? vscode.Uri.file(message.relativePath)
            : wsRoot
              ? vscode.Uri.joinPath(wsRoot, message.relativePath)
              : null;
          if (fileUri) {
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
        } else if (message.type === "activatePlan") {
          try {
            if (!this.onActivatePlan) {
              this.postMessage({
                type: "activatePlanResult",
                id: message.id,
                ok: false,
                error: "no_handler",
              });
              return;
            }
            await this.onActivatePlan(message.id);
            this.postMessage({
              type: "activatePlanResult",
              id: message.id,
              ok: true,
            });
          } catch (err) {
            this.postMessage({
              type: "activatePlanResult",
              id: message.id,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (message.type === "deactivatePlan") {
          try {
            if (!this.onDeactivatePlan) {
              this.postMessage({
                type: "deactivatePlanResult",
                id: message.id,
                ok: false,
                error: "no_handler",
              });
              return;
            }
            await this.onDeactivatePlan(message.id);
            this.postMessage({
              type: "deactivatePlanResult",
              id: message.id,
              ok: true,
            });
          } catch (err) {
            this.postMessage({
              type: "deactivatePlanResult",
              id: message.id,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (message.type === "pauseActivePlan") {
          try {
            await this.onPauseActivePlan?.(message.id);
            this.postMessage({
              type: "pauseActivePlanResult",
              id: message.id,
              ok: true,
            });
          } catch (err) {
            this.postMessage({
              type: "pauseActivePlanResult",
              id: message.id,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (message.type === "changeActivePlanFile") {
          const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: { Markdown: ["md"] },
          });
          if (!uris || uris.length === 0) {
            this.postMessage({
              type: "changeActivePlanFileResult",
              ok: true,
            });
            return;
          }
          const relPath = toWorkspaceRelative(uris[0], this.isJa);
          if (relPath === null) {
            this.postMessage({
              type: "changeActivePlanFileResult",
              ok: false,
              error: "outside_workspace",
            });
            return;
          }
          try {
            await this.onChangeActivePlanFile?.(relPath);
            this.postMessage({
              type: "changeActivePlanFileResult",
              ok: true,
            });
          } catch (err) {
            this.postMessage({
              type: "changeActivePlanFileResult",
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (message.type === "openPlanPanel") {
          await vscode.commands.executeCommand("mentor-studio.openPlanPanel");
          return;
        } else if (message.type === "cleanupMentor") {
          const opts = message.options;
          if (
            typeof opts !== "object" ||
            opts === null ||
            typeof opts.mentorFolder !== "boolean" ||
            typeof opts.profile !== "boolean" ||
            typeof opts.entrypointFiles !== "boolean" ||
            typeof opts.wipeExternalDb !== "boolean"
          ) {
            return;
          }
          await vscode.commands.executeCommand(
            "mentor-studio.cleanupMentor",
            opts,
          );
        } else if (message.type === "openDataLocation") {
          await vscode.commands.executeCommand(
            "revealFileInOS",
            vscode.Uri.file(message.path),
          );
        } else if (message.type === "openExtensionsView") {
          await vscode.commands.executeCommand("workbench.view.extensions");
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

  getSubscriber(): { postMessage(msg: unknown): void } {
    return {
      postMessage: (msg: unknown) => {
        void this.view?.webview.postMessage(msg);
      },
    };
  }

  async sendConfig(config: MentorStudioConfig): Promise<void> {
    this.latestConfig = config;
    this.hasConfig = true;
    this.needsMigration = false;
    await this.postConfigMessage(config);
  }

  private async readWorkspaceIdFromConfig(): Promise<string | null> {
    try {
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!wsRoot) return null;
      const configUri = vscode.Uri.joinPath(wsRoot, ".mentor", "config.json");
      const bytes = await vscode.workspace.fs.readFile(configUri);
      const obj = JSON.parse(Buffer.from(bytes).toString()) as Record<
        string,
        unknown
      >;
      return typeof obj.workspaceId === "string" && obj.workspaceId.length > 0
        ? obj.workspaceId
        : null;
    } catch {
      return null;
    }
  }

  private async buildDataLocation(): Promise<
    { dbPath: string; dirPath: string } | undefined
  > {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsRoot) return undefined;
    const workspaceId = await this.readWorkspaceIdFromConfig();
    if (!workspaceId) return undefined;
    const paths = derivePaths({ workspaceRoot: wsRoot, workspaceId });
    return {
      dbPath: paths.dbPath,
      dirPath: paths.externalDataDirForWorkspace ?? paths.mentorRoot,
    };
  }

  sendNoConfig(): void {
    this.hasConfig = false;
    this.needsMigration = false;
    this.postMessage({ type: "noConfig", locale: this.detectLocale() });
  }

  sendNeedsMigration(): void {
    this.hasConfig = false;
    this.needsMigration = true;
    this.postMessage({
      type: "needsMigration",
      locale: this.detectLocale(),
    });
  }

  async showCleanupResultDialog(
    deleted: CleanupOptions,
    isJa: boolean,
  ): Promise<void> {
    const items: string[] = [];
    if (deleted.mentorFolder) {
      items.push(isJa ? ".mentor フォルダ" : ".mentor folder");
    }
    if (deleted.profile) {
      items.push(
        isJa
          ? "プロフィールデータ（拡張機能ストレージ）"
          : "Profile data (extension storage)",
      );
    }
    if (deleted.entrypointFiles) {
      items.push(
        isJa
          ? "AI ツールのエントリポイント内のメンター参照"
          : "Mentor references in AI entrypoint files",
      );
    }
    if (deleted.wipeExternalDb) {
      items.push(
        isJa
          ? "学習履歴 DB（外部ストレージ）"
          : "Learning history DB (external storage)",
      );
    }

    if (items.length === 0) {
      return;
    }

    const itemsText = items.join(isJa ? "、" : ", ");
    const message = isJa
      ? `${itemsText}を消去しました。Mentor Studio Code を削除する場合は拡張機能ビューからアンインストールしてください。`
      : `Deleted: ${itemsText}. To remove Mentor Studio Code, uninstall it from the Extensions view.`;
    await vscode.window.showInformationMessage(message);
  }

  private detectLocale(): Locale {
    return vscode.env.language.startsWith("ja") ? "ja" : "en";
  }

  private get isJa(): boolean {
    return (this.latestConfig?.locale ?? this.detectLocale()) !== "en";
  }

  private async restoreSettingsState(): Promise<void> {
    if (this.latestConfig) {
      await this.postConfigMessage(this.latestConfig);
    }
  }

  private async confirmSettingsEntrypointEdit(messageJa: string, messageEn: string) {
    const confirmLabel = this.isJa ? "続行する" : "Continue";
    const choice = await vscode.window.showWarningMessage(
      this.isJa ? messageJa : messageEn,
      { modal: true },
      confirmLabel,
    );
    return choice === confirmLabel;
  }

  private async flushState(): Promise<void> {
    if (this.needsMigration) {
      this.postMessage({
        type: "needsMigration",
        locale: this.detectLocale(),
      });
      return;
    }
    if (!this.hasConfig) {
      this.postMessage({ type: "noConfig", locale: this.detectLocale() });
      return;
    }
    if (this.latestConfig) {
      await this.postConfigMessage(this.latestConfig);
    }
    if (this.latestData) {
      this.postMessage({ type: "update", data: this.latestData });
    }
  }

  private async updateConfig(
    mutate: (
      config: MentorStudioConfig,
      rawObj: Record<string, unknown>,
    ) => void,
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
      // Preserve unknown fields by merging typed changes into raw JSON. The
      // mutate callback can also touch rawObj directly to delete fields that
      // don't live on MentorStudioConfig (e.g. extensionUninstalled).
      const rawObj = JSON.parse(rawText) as Record<string, unknown>;
      mutate(parsed, rawObj);
      Object.assign(rawObj, parsed);
      await vscode.workspace.fs.writeFile(
        configUri,
        Buffer.from(JSON.stringify(rawObj, null, 2) + "\n"),
      );
      this.latestConfig = parsed;
      await this.postConfigMessage(parsed);
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

    // Toggling ON — require at least one configured entrypoint.
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!wsRoot) {
      return;
    }

    const status = await getEntrypointStatus(wsRoot);

    if (status.hasEntrypointFile) {
      await this.updateConfig((config, rawObj) => {
        config.enableMentor = true;
        delete rawObj.extensionUninstalled;
      });
      return;
    }

    vscode.window.showInformationMessage(
      this.isJa
        ? "有効なエントリポイントファイルがないため、有効化できません。CLAUDE.md または AGENTS.md を設定してください。"
        : "Cannot enable Mentor because no entrypoint file is configured. Configure CLAUDE.md or AGENTS.md first.",
    );
    if (this.latestConfig) {
      await this.postConfigMessage(this.latestConfig);
    }
  }

  private async setClaudeMdEnabled(value: boolean): Promise<void> {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!wsRoot) {
      return;
    }
    const confirmed = await this.confirmSettingsEntrypointEdit(
      value
        ? "`CLAUDE.md` を更新して Mentor 参照を追加します。続行しますか？"
        : "`CLAUDE.md` から Mentor 参照を削除します。続行しますか？",
      value
        ? "This will update `CLAUDE.md` and add the Mentor reference. Continue?"
        : "This will remove the Mentor reference from `CLAUDE.md`. Continue?",
    );
    if (!confirmed) {
      await this.restoreSettingsState();
      return;
    }
    if (value) {
      const status = await getEntrypointStatus(wsRoot);
      await setClaudeMdScopeOnDisk(wsRoot, status.claudeMdScope ?? "project");
    } else {
      await Promise.all([
        removeProjectClaudeMdEntrypoint(wsRoot),
        removePersonalClaudeMdEntrypoint(wsRoot),
      ]);
    }
    if (this.latestConfig) {
      await this.postConfigMessage(this.latestConfig);
    }
  }

  private async setClaudeMdScope(
    value: "project" | "personal",
  ): Promise<void> {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!wsRoot) {
      return;
    }
    const status = await getEntrypointStatus(wsRoot);
    const movingToPersonal =
      value === "personal" && status.claudeMdScope === "project";
    const movingToProject =
      value === "project" && status.claudeMdScope === "personal";
    const confirmed = await this.confirmSettingsEntrypointEdit(
      movingToPersonal
        ? "Mentor 参照をプロジェクトの `CLAUDE.md` から個人用 `CLAUDE.md` に移動します。続行しますか？"
        : movingToProject
          ? "Mentor 参照を個人用 `CLAUDE.md` からプロジェクトの `CLAUDE.md` に移動します。続行しますか？"
          : "`CLAUDE.md` の Mentor 参照を更新します。続行しますか？",
      movingToPersonal
        ? "This will move the Mentor reference from the project `CLAUDE.md` to your personal `CLAUDE.md`. Continue?"
        : movingToProject
          ? "This will move the Mentor reference from your personal `CLAUDE.md` to the project `CLAUDE.md`. Continue?"
          : "This will update the Mentor reference in `CLAUDE.md`. Continue?",
    );
    if (!confirmed) {
      await this.restoreSettingsState();
      return;
    }
    await setClaudeMdScopeOnDisk(wsRoot, value);
    if (this.latestConfig) {
      await this.postConfigMessage(this.latestConfig);
    }
  }

  private async setAgentsMdEnabled(value: boolean): Promise<void> {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!wsRoot) {
      return;
    }
    const confirmed = await this.confirmSettingsEntrypointEdit(
      value
        ? "`AGENTS.md` を更新して Mentor 参照を追加します。続行しますか？"
        : "`AGENTS.md` から Mentor 参照を削除します。続行しますか？",
      value
        ? "This will update `AGENTS.md` and add the Mentor reference. Continue?"
        : "This will remove the Mentor reference from `AGENTS.md`. Continue?",
    );
    if (!confirmed) {
      await this.restoreSettingsState();
      return;
    }
    if (value) {
      await ensureProjectAgentsMdEntrypoint(wsRoot);
    } else {
      await removeProjectAgentsMdEntrypoint(wsRoot);
    }
    if (this.latestConfig) {
      await this.postConfigMessage(this.latestConfig);
    }
  }

  private async updateMentorFile(
    field: FileField,
    value: string | null,
  ): Promise<void> {
    if (field === "plan") {
      throw new Error("mentorFiles.plan is managed by Plan Panel, not Sidebar");
    }
    await this.updateConfig((config) => {
      const mentorFiles = config.mentorFiles ?? { spec: null };
      mentorFiles.spec = value;
      config.mentorFiles = mentorFiles;
    });
  }

  private postMessage(message: ExtensionMessage): void {
    this.view?.webview.postMessage(message);
  }

  private async buildEntrypointStatus(): Promise<MentorEntrypointFileStatus> {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!wsRoot) {
      return {
        claudeMdEnabled: false,
        claudeMdScope: null,
        projectClaudeMd: false,
        personalClaudeMd: false,
        agentsMdEnabled: false,
        hasEntrypointFile: false,
      };
    }
    const status = await getEntrypointStatus(wsRoot);
    return {
      claudeMdEnabled: status.projectClaudeMd || status.personalClaudeMd,
      claudeMdScope: status.claudeMdScope,
      projectClaudeMd: status.projectClaudeMd,
      personalClaudeMd: status.personalClaudeMd,
      agentsMdEnabled: status.projectAgentsMd,
      hasEntrypointFile: status.hasEntrypointFile,
    };
  }

  private async postConfigMessage(config: MentorStudioConfig): Promise<void> {
    const [dataLocation, entrypointStatus] = await Promise.all([
      this.buildDataLocation(),
      this.buildEntrypointStatus(),
    ]);
    this.postMessage({
      type: "config",
      data: config,
      dataLocation,
      entrypointStatus,
    });
  }

  private getHtml(webview: vscode.Webview, locale: Locale): string {
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
