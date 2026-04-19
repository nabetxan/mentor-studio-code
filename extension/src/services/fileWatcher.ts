import type { DashboardData, MentorStudioConfig } from "@mentor-studio/shared";
import { readFile, writeFile } from "fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "path";
import * as vscode from "vscode";
import { loadSqlJs } from "../db";
import {
  activatePlan as dbActivatePlan,
  addPlanToBacklog as dbAddPlanToBacklog,
  deactivatePlan as dbDeactivatePlan,
  pausePlan as dbPausePlan,
  setAsActivePlan as dbSetAsActivePlan,
} from "../panels/writes/planWrites";
import { parseConfig, parseLearnerProfile } from "./dataParser";
import {
  computeDashboardDataFromDb,
  dbAddTopic,
  dbDeleteTopics,
  dbMergeTopic,
  dbUpdateTopicLabel,
  parseMinimalProgress,
} from "./dbDashboard";

export function generateTopicKey(label: string): string {
  const sanitized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!sanitized) return "";
  return `c-${sanitized}`;
}

export class FileWatcherService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private config: MentorStudioConfig | null = null;
  private rawConfig: Record<string, unknown> | null = null;
  private syncing = false;
  private dbDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private workspaceRoot: string,
    private mentorPath: string,
    private onDataChanged: (data: DashboardData) => void,
    private onConfigChanged?: (config: MentorStudioConfig | null) => void,
    private log?: (message: string) => void,
    private globalState?: vscode.Memento,
    private onDbChanged?: () => void | Promise<void>,
    private dbPath?: string,
    private wasmPath?: string,
  ) {}

  async start(): Promise<void> {
    await this.loadConfig();

    const progressPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      `${this.mentorPath}/progress.json`,
    );
    const progressWatcher =
      vscode.workspace.createFileSystemWatcher(progressPattern);
    const onProgressChange = (): void => {
      void this.refresh().catch((err) =>
        this.log?.(`refresh failed: ${String(err)}`),
      );
    };
    progressWatcher.onDidChange(onProgressChange);
    progressWatcher.onDidCreate(onProgressChange);
    this.disposables.push(progressWatcher);

    const dbPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      `${this.mentorPath}/data.db`,
    );
    const dbWatcher = vscode.workspace.createFileSystemWatcher(dbPattern);
    const fireDbChanged = (): void => {
      if (this.dbDebounceTimer) clearTimeout(this.dbDebounceTimer);
      this.dbDebounceTimer = setTimeout(() => {
        this.dbDebounceTimer = null;
        void (async () => {
          try {
            await this.onDbChanged?.();
          } catch (err) {
            this.log?.(`onDbChanged failed: ${String(err)}`);
          }
          try {
            await this.refresh();
          } catch (err) {
            this.log?.(`refresh after dbChanged failed: ${String(err)}`);
          }
        })();
      }, 300);
    };
    dbWatcher.onDidChange(fireDbChanged);
    dbWatcher.onDidCreate(fireDbChanged);
    this.disposables.push(dbWatcher);

    const configPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      ".mentor/config.json",
    );
    const configWatcher =
      vscode.workspace.createFileSystemWatcher(configPattern);
    const reloadConfig = (): void => {
      void this.loadConfig()
        .then(() => this.emitConfig())
        .catch((err) => this.log?.(`loadConfig failed: ${String(err)}`));
    };
    const handleConfigDelete = (): void => {
      this.config = null;
      this.rawConfig = null;
      this.onConfigChanged?.(null);
    };
    configWatcher.onDidChange(reloadConfig);
    configWatcher.onDidCreate(reloadConfig);
    configWatcher.onDidDelete(handleConfigDelete);
    this.disposables.push(configWatcher);

    // macOS fsevents may skip the config.json delete when .mentor is
    // recursively removed. Watch the directory itself so we still flip the
    // sidebar to the noConfig view when the whole folder disappears.
    const mentorDirPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      this.mentorPath,
    );
    const mentorDirWatcher =
      vscode.workspace.createFileSystemWatcher(mentorDirPattern);
    mentorDirWatcher.onDidDelete(handleConfigDelete);
    mentorDirWatcher.onDidCreate(reloadConfig);
    this.disposables.push(mentorDirWatcher);

    await this.refresh();
  }

  private async loadConfig(): Promise<void> {
    try {
      const configPath = join(this.workspaceRoot, ".mentor", "config.json");
      const raw = await readFile(configPath, "utf-8");
      this.config = parseConfig(raw);
      this.rawConfig = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      this.config = null;
      this.rawConfig = null;
    }
  }

  private async emitConfig(): Promise<void> {
    if (!this.config) {
      this.onConfigChanged?.(null);
      return;
    }
    this.onConfigChanged?.(this.config);
  }

  // Extension-initiated writes use atomic rename (see atomicWriteFile), which
  // VSCode's FileSystemWatcher does not reliably detect — Plan Panel would
  // stay stale until the next unrelated event. Broadcast directly here and
  // refresh sidebar data. Safe if the watcher also fires later: both paths
  // are idempotent.
  private async notifyWrite(): Promise<void> {
    try {
      await this.onDbChanged?.();
    } catch (err) {
      this.log?.(`onDbChanged failed: ${String(err)}`);
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const progressPath = join(
      this.workspaceRoot,
      this.mentorPath,
      "progress.json",
    );

    let progressRaw: string | null = null;
    try {
      progressRaw = await readFile(progressPath, "utf-8");
    } catch {
      progressRaw = null;
    }
    const progress = progressRaw ? parseMinimalProgress(progressRaw) : {};

    if (!this.dbPath || !this.wasmPath || !existsSync(this.dbPath)) {
      // DB not yet created (pre-migration or fresh setup) — emit empty dashboard
      this.onDataChanged({
        totalQuestions: 0,
        correctRate: 0,
        byTopic: [],
        allTopics: [],
        unresolvedGaps: [],
        completedTasks: [],
        currentTask: null,
        profileLastUpdated: progress.learner_profile?.last_updated ?? null,
        topicsWithHistory: [],
        plans: [],
        activePlan: null,
        nextPlan: null,
      });
      return;
    }

    try {
      const SQL = await loadSqlJs(this.wasmPath);
      const db = new SQL.Database(readFileSync(this.dbPath));
      try {
        const data = computeDashboardDataFromDb(db, progress);
        this.onDataChanged(data);
      } finally {
        db.close();
      }
    } catch (err) {
      this.log?.(`computeDashboardDataFromDb failed: ${String(err)}`);
      return;
    }

    if (this.config) {
      this.onConfigChanged?.(this.config);
    }

    if (progressRaw) await this.syncLearnerProfile(progressPath);
  }

  async mergeTopic(fromKey: string, toKey: string): Promise<void> {
    if (!this.dbPath || !this.wasmPath) return;
    await dbMergeTopic(this.dbPath, fromKey, toKey, this.wasmPath);
    await this.notifyWrite();
  }

  async deleteTopics(
    keys: string[],
  ): Promise<{ key: string; ok: boolean; error?: string }[]> {
    if (!this.dbPath || !this.wasmPath) {
      return keys.map((key) => ({ key, ok: false, error: "db_not_ready" }));
    }
    const results = await dbDeleteTopics(this.dbPath, keys, this.wasmPath);
    await this.notifyWrite();
    return results;
  }

  async addTopic(
    label: string,
  ): Promise<{ ok: boolean; key?: string; error?: string }> {
    if (!this.dbPath || !this.wasmPath) {
      return { ok: false, error: "db_not_ready" };
    }
    const res = await dbAddTopic(this.dbPath, label, this.wasmPath);
    if (res.ok) await this.notifyWrite();
    return res;
  }

  async updateTopicLabel(key: string, newLabel: string): Promise<void> {
    if (!this.dbPath || !this.wasmPath) return;
    await dbUpdateTopicLabel(this.dbPath, key, newLabel, this.wasmPath);
    await this.notifyWrite();
  }

  async activatePlan(id: number): Promise<void> {
    if (!this.dbPath || !this.wasmPath) {
      throw new Error("db_not_ready");
    }
    await dbActivatePlan(this.dbPath, { id }, this.wasmPath);
    await this.notifyWrite();
  }

  async deactivatePlan(id: number): Promise<void> {
    if (!this.dbPath || !this.wasmPath) {
      throw new Error("db_not_ready");
    }
    await dbDeactivatePlan(this.dbPath, { id }, this.wasmPath);
    await this.notifyWrite();
  }

  async pauseActivePlan(id: number): Promise<void> {
    if (!this.dbPath || !this.wasmPath) {
      throw new Error("db_not_ready");
    }
    await dbPausePlan(this.dbPath, id, this.wasmPath);
    await this.notifyWrite();
  }

  async changeActivePlanFile(relPath: string): Promise<void> {
    if (!this.dbPath || !this.wasmPath) {
      throw new Error("db_not_ready");
    }
    const name = basename(relPath, ".md");
    await dbSetAsActivePlan(
      this.dbPath,
      { name, filePath: relPath },
      this.wasmPath,
    );
    await this.notifyWrite();
  }

  async createAndActivatePlan(relPath: string): Promise<void> {
    if (!this.dbPath || !this.wasmPath) throw new Error("db_not_ready");
    const name = basename(relPath, ".md");
    await dbSetAsActivePlan(
      this.dbPath,
      { name, filePath: relPath },
      this.wasmPath,
    );
    await this.notifyWrite();
  }

  async setFileAsSpec(uri: vscode.Uri): Promise<void> {
    if (!uri.fsPath.endsWith(".md")) return;
    if (!vscode.workspace.getWorkspaceFolder(uri)) {
      await vscode.window.showErrorMessage(
        "File must be inside the workspace.",
      );
      return;
    }

    const relPath = vscode.workspace.asRelativePath(uri, false);
    const configPath = join(this.workspaceRoot, ".mentor", "config.json");

    let rawText: string;
    try {
      rawText = await readFile(configPath, "utf-8");
    } catch {
      await vscode.window.showErrorMessage(
        ".mentor/config.json not found. Run Setup Mentor first.",
      );
      return;
    }

    const parsed = parseConfig(rawText);
    if (!parsed) {
      await vscode.window.showErrorMessage(
        ".mentor/config.json has invalid format.",
      );
      return;
    }

    const currentSpec = parsed.mentorFiles?.spec ?? null;

    if (currentSpec === relPath) {
      await vscode.window.showInformationMessage(
        `${relPath} is already set as the Mentor Spec.`,
      );
      return;
    }

    if (currentSpec) {
      const replace = "Replace";
      const choice = await vscode.window.showWarningMessage(
        `Replace current Mentor Spec "${currentSpec}" with "${relPath}"?`,
        { modal: true },
        replace,
      );
      if (choice !== replace) return;
    }

    let rawObj: Record<string, unknown>;
    try {
      rawObj = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      await vscode.window.showErrorMessage(
        ".mentor/config.json has invalid JSON.",
      );
      return;
    }
    const mentorFiles =
      (rawObj.mentorFiles as Record<string, unknown> | undefined) ?? {};
    mentorFiles.spec = relPath;
    rawObj.mentorFiles = mentorFiles;

    try {
      await writeFile(configPath, JSON.stringify(rawObj, null, 2) + "\n");
    } catch (err) {
      await vscode.window.showErrorMessage(
        `Failed to update .mentor/config.json: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    await vscode.window.showInformationMessage(
      `Set Mentor Spec to "${relPath}".`,
    );
  }

  async addFilesToPlan(uris: vscode.Uri[]): Promise<void> {
    if (!this.dbPath || !this.wasmPath) return;
    if (uris.length === 0) return;

    const dbPath = this.dbPath;
    const wasmPath = this.wasmPath;

    let added = 0;
    let skipped = 0;

    // Bulk selection (2+ files) must never silently auto-activate one of the
    // chosen files; the user asked for "add to plan", not "pick one to start".
    const mdUris = uris.filter((u) => u.fsPath.endsWith(".md"));
    const autoActivate = mdUris.length === 1;

    for (const uri of mdUris) {
      const relPath = vscode.workspace.asRelativePath(uri, false);
      const name = basename(relPath, ".md");

      const result = await dbAddPlanToBacklog(
        dbPath,
        { name, filePath: relPath, autoActivate },
        wasmPath,
      );
      if (result.created || result.restored) {
        added++;
      } else {
        skipped++;
      }
    }

    // No .md files at all — do nothing
    if (added === 0 && skipped === 0) return;

    await this.notifyWrite();

    const openPlanPanel = "Open Plan Panel";

    if (added === 0) {
      // All skipped
      await vscode.window.showWarningMessage(
        `${skipped} file(s) already exist in the Mentor Plan and were skipped.`,
      );
    } else if (skipped === 0) {
      // All added
      const choice = await vscode.window.showInformationMessage(
        `Added ${added} file(s) to the Mentor Plan.`,
        openPlanPanel,
      );
      if (choice === openPlanPanel) {
        await vscode.commands.executeCommand("mentor-studio.openPlanPanel");
      }
    } else {
      // Mixed
      const choice = await vscode.window.showInformationMessage(
        `Added ${added} file(s) to the Mentor Plan. ${skipped} file(s) already existed and were skipped.`,
        openPlanPanel,
      );
      if (choice === openPlanPanel) {
        await vscode.commands.executeCommand("mentor-studio.openPlanPanel");
      }
    }
  }

  private async syncLearnerProfile(progressPath: string): Promise<void> {
    if (this.syncing || !this.globalState) return;
    try {
      const rawText = await readFile(progressPath, "utf-8");
      const rawObj = JSON.parse(rawText) as Record<string, unknown>;
      const fileProfile = parseLearnerProfile(rawObj.learner_profile);
      const globalProfile = parseLearnerProfile(
        this.globalState.get<unknown>("learnerProfile"),
      );

      const fileTime = fileProfile?.last_updated
        ? new Date(fileProfile.last_updated).getTime() || 0
        : 0;
      const globalTime = globalProfile?.last_updated
        ? new Date(globalProfile.last_updated).getTime() || 0
        : 0;

      if (fileTime === 0 && globalTime === 0) return;

      if (globalTime > fileTime) {
        this.syncing = true;
        try {
          rawObj.learner_profile = globalProfile;
          await writeFile(progressPath, JSON.stringify(rawObj, null, 2) + "\n");
          this.log?.(
            "Synced learner_profile from globalState to progress.json",
          );
        } finally {
          this.syncing = false;
        }
      } else if (fileTime > globalTime) {
        await this.globalState.update("learnerProfile", fileProfile);
        this.log?.("Synced learner_profile from progress.json to globalState");
      }
    } catch (err) {
      this.log?.(`syncLearnerProfile failed: ${String(err)}`);
    }
  }

  getConfig(): MentorStudioConfig | null {
    return this.config;
  }

  dispose(): void {
    if (this.dbDebounceTimer) {
      clearTimeout(this.dbDebounceTimer);
      this.dbDebounceTimer = null;
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
