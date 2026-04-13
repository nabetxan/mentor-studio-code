import type { DashboardData, MentorStudioConfig } from "@mentor-studio/shared";
import { readFile, writeFile } from "fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "path";
import * as vscode from "vscode";
import { loadSqlJs } from "../db";
import { parseConfig, parseLearnerProfile } from "./dataParser";
import {
  computeDashboardDataFromDb,
  dbAddTopic,
  dbDeleteTopics,
  dbMergeTopic,
  dbReadTopics,
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
    configWatcher.onDidChange(reloadConfig);
    configWatcher.onDidCreate(reloadConfig);
    configWatcher.onDidDelete(() => {
      this.config = null;
      this.rawConfig = null;
      this.onConfigChanged?.(null);
    });
    this.disposables.push(configWatcher);

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
    await this.hydrateTopicsFromDb();
    this.onConfigChanged?.(this.config);
  }

  private async hydrateTopicsFromDb(): Promise<void> {
    if (!this.config || !this.dbPath || !this.wasmPath) return;
    if (!existsSync(this.dbPath)) return;
    try {
      const topics = await dbReadTopics(this.dbPath, this.wasmPath);
      this.config = { ...this.config, topics };
    } catch (err) {
      this.log?.(`hydrateTopicsFromDb failed: ${String(err)}`);
    }
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
    const progress = progressRaw
      ? parseMinimalProgress(progressRaw)
      : { current_task: null };

    if (!this.dbPath || !this.wasmPath || !existsSync(this.dbPath)) {
      // DB not yet created (pre-migration or fresh setup) — emit empty dashboard
      this.onDataChanged({
        totalQuestions: 0,
        correctRate: 0,
        byTopic: [],
        unresolvedGaps: [],
        completedTasks: [],
        currentTask: null,
        profileLastUpdated: progress.learner_profile?.last_updated ?? null,
        topicsWithHistory: [],
      });
      return;
    }

    await this.hydrateTopicsFromDb();

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
    await this.refresh();
  }

  async deleteTopics(
    keys: string[],
  ): Promise<{ key: string; ok: boolean; error?: string }[]> {
    if (!this.dbPath || !this.wasmPath) {
      return keys.map((key) => ({ key, ok: false, error: "db_not_ready" }));
    }
    const results = await dbDeleteTopics(this.dbPath, keys, this.wasmPath);
    await this.refresh();
    return results;
  }

  async addTopic(
    label: string,
  ): Promise<{ ok: boolean; key?: string; error?: string }> {
    if (!this.dbPath || !this.wasmPath) {
      return { ok: false, error: "db_not_ready" };
    }
    const res = await dbAddTopic(this.dbPath, label, this.wasmPath);
    if (res.ok) await this.refresh();
    return res;
  }

  async updateTopicLabel(key: string, newLabel: string): Promise<void> {
    if (!this.dbPath || !this.wasmPath) return;
    await dbUpdateTopicLabel(this.dbPath, key, newLabel, this.wasmPath);
    await this.refresh();
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
