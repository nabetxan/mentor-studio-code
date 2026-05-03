import type {
  DashboardData,
  LearnerProfile,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import * as os from "os";
import { readFile, writeFile } from "fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "path";
import * as vscode from "vscode";
import { loadSqlJs, parseJsonStringArray } from "../db";
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
} from "./dbDashboard";
import { insertLearnerProfileRow } from "./profileWrites";

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

    const watchedDbPath = this.dbPath ?? join(this.workspaceRoot, this.mentorPath, "data.db");
    const dbPattern = new vscode.RelativePattern(
      dirname(watchedDbPath),
      basename(watchedDbPath),
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

    const fireEntrypointChanged = (): void => {
      void this.emitConfig().catch((err) =>
        this.log?.(`emitConfig failed: ${String(err)}`),
      );
    };
    const entrypointPatterns = [
      new vscode.RelativePattern(this.workspaceRoot, "CLAUDE.md"),
      new vscode.RelativePattern(this.workspaceRoot, "AGENTS.md"),
      new vscode.RelativePattern(
        dirname(
          join(
            os.homedir(),
            ".claude",
            "projects",
            this.workspaceRoot.replace(/[:\\/]/g, "-"),
            "CLAUDE.md",
          ),
        ),
        basename(
          join(
            os.homedir(),
            ".claude",
            "projects",
            this.workspaceRoot.replace(/[:\\/]/g, "-"),
            "CLAUDE.md",
          ),
        ),
      ),
    ];
    for (const pattern of entrypointPatterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidChange(fireEntrypointChanged);
      watcher.onDidCreate(fireEntrypointChanged);
      watcher.onDidDelete(fireEntrypointChanged);
      this.disposables.push(watcher);
    }

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
        profileLastUpdated: null,
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
        const data = computeDashboardDataFromDb(db);
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

    await this.syncLearnerProfileFromDb();
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

  private async syncLearnerProfileFromDb(): Promise<void> {
    if (
      this.syncing ||
      !this.globalState ||
      !this.dbPath ||
      !this.wasmPath ||
      !existsSync(this.dbPath)
    ) {
      return;
    }
    try {
      let dbProfile: LearnerProfile | null;
      const SQL = await loadSqlJs(this.wasmPath);
      const db = new SQL.Database(readFileSync(this.dbPath));
      try {
        const res = db.exec(
          `SELECT experience, level, interests, weakAreas, mentorStyle, lastUpdated
           FROM learner_profile
           ORDER BY lastUpdated DESC, id DESC
           LIMIT 1`,
        )[0];
        if (!res || res.values.length === 0) {
          dbProfile = null;
        } else {
          const [exp, lvl, inter, weak, style, lu] = res.values[0];
          dbProfile = {
            experience: String(exp ?? ""),
            level: String(lvl ?? ""),
            interests: parseJsonStringArray(inter),
            weak_areas: parseJsonStringArray(weak),
            mentor_style: String(style ?? ""),
            last_updated:
              lu === null || lu === undefined ? null : String(lu),
          };
        }
      } finally {
        db.close();
      }

      const globalProfile = parseLearnerProfile(
        this.globalState.get<unknown>("learnerProfile"),
      );
      const dbTime = dbProfile?.last_updated
        ? new Date(dbProfile.last_updated).getTime() || 0
        : 0;
      const globalTime = globalProfile?.last_updated
        ? new Date(globalProfile.last_updated).getTime() || 0
        : 0;

      if (dbTime === 0 && globalTime === 0) return;

      if (globalTime > dbTime && globalProfile) {
        this.syncing = true;
        try {
          await insertLearnerProfileRow(
            this.dbPath,
            this.wasmPath,
            globalProfile,
          );
          this.log?.(
            "Synced learner_profile from globalState to DB (append)",
          );
        } finally {
          this.syncing = false;
        }
      } else if (dbTime > globalTime && dbProfile) {
        await this.globalState.update("learnerProfile", dbProfile);
        this.log?.("Synced learner_profile from DB to globalState");
      }
    } catch (err) {
      this.log?.(`syncLearnerProfileFromDb failed: ${String(err)}`);
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
