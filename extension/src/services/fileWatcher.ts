import type { DashboardData, MentorStudioConfig } from "@mentor-studio/shared";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import * as vscode from "vscode";
import {
  computeDashboardData,
  parseConfig,
  parseLearnerProfile,
  parseProgressData,
  parseQuestionHistory,
} from "./dataParser";

function isFileNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}

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

  constructor(
    private workspaceRoot: string,
    private mentorPath: string,
    private onDataChanged: (data: DashboardData) => void,
    private onConfigChanged?: (config: MentorStudioConfig | null) => void,
    private log?: (message: string) => void,
    private globalState?: vscode.Memento,
  ) {}

  async start(): Promise<void> {
    await this.loadConfig();

    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      `${this.mentorPath}/{progress,question-history}.json`,
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const onFileChange = () =>
      void this.refresh().catch((err) =>
        this.log?.(`refresh failed: ${String(err)}`),
      );
    watcher.onDidChange(onFileChange);
    watcher.onDidCreate(onFileChange);
    this.disposables.push(watcher);

    const configPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      ".mentor/config.json",
    );
    const configWatcher =
      vscode.workspace.createFileSystemWatcher(configPattern);

    const reloadConfig = (): void => {
      void this.loadConfig()
        .then(() => {
          this.onConfigChanged?.(this.config);
        })
        .catch((err) => this.log?.(`loadConfig failed: ${String(err)}`));
    };
    configWatcher.onDidChange(reloadConfig);
    configWatcher.onDidCreate(reloadConfig);
    configWatcher.onDidDelete(() => {
      this.config = null;
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

  async refresh(): Promise<void> {
    const progressPath = join(
      this.workspaceRoot,
      this.mentorPath,
      "progress.json",
    );
    const historyPath = join(
      this.workspaceRoot,
      this.mentorPath,
      "question-history.json",
    );

    let progressRaw: string;
    try {
      progressRaw = await readFile(progressPath, "utf-8");
    } catch {
      return; // progress.json not available yet
    }

    const progress = parseProgressData(progressRaw);
    if (!progress) {
      this.log?.("Invalid JSON in progress.json — skipping dashboard update");
      void vscode.window.showWarningMessage(
        "Mentor Studio Code: progress.json has invalid JSON. Please fix it manually or ask the AI to correct it.",
      );
      return;
    }

    let historyRaw: string | null = null;
    try {
      historyRaw = await readFile(historyPath, "utf-8");
    } catch {
      // question-history.json may not exist yet — use empty history
    }

    const history = parseQuestionHistory(historyRaw ?? '{"history":[]}');
    if (historyRaw !== null && history.history.length === 0) {
      const trimmed = historyRaw.trim();
      if (trimmed !== "" && trimmed !== '{"history":[]}') {
        try {
          JSON.parse(trimmed);
        } catch {
          this.log?.(
            "Invalid JSON in question-history.json — using empty history",
          );
          void vscode.window.showWarningMessage(
            "Mentor Studio Code: question-history.json has invalid JSON. Please fix it manually or ask the AI to correct it.",
          );
        }
      }
    }
    const topics = this.config?.topics ?? [];
    const data = computeDashboardData(progress, history, topics);
    this.onDataChanged(data);
    await this.syncLearnerProfile(progressPath);
  }

  async mergeTopic(fromKey: string, toKey: string): Promise<void> {
    const historyPath = join(
      this.workspaceRoot,
      this.mentorPath,
      "question-history.json",
    );
    const raw = await readFile(historyPath, "utf-8");
    const history = parseQuestionHistory(raw);
    for (const entry of history.history) {
      if (entry.topic === fromKey) {
        entry.topic = toKey;
      }
    }
    await writeFile(historyPath, JSON.stringify(history, null, 2) + "\n");

    // Also update unresolved_gaps in progress.json
    const progressPath = join(
      this.workspaceRoot,
      this.mentorPath,
      "progress.json",
    );
    try {
      const progressRaw = await readFile(progressPath, "utf-8");
      const rawObj = JSON.parse(progressRaw) as Record<string, unknown>;
      if (
        typeof rawObj === "object" &&
        rawObj !== null &&
        Array.isArray(rawObj.unresolved_gaps)
      ) {
        let changed = false;
        for (const gap of rawObj.unresolved_gaps as unknown[]) {
          if (typeof gap !== "object" || gap === null) continue;
          const g = gap as Record<string, unknown>;
          if (g.topic === fromKey) {
            g.topic = toKey;
            changed = true;
          }
        }
        if (changed) {
          await writeFile(progressPath, JSON.stringify(rawObj, null, 2) + "\n");
        }
      }
    } catch {
      // progress.json may not exist yet or invalid — skip
    }

    if (!this.config) return;
    this.config = {
      ...this.config,
      topics: this.config.topics.filter((t) => t.key !== fromKey),
    };
    await this.saveConfig();
  }

  async deleteTopics(
    keys: string[],
  ): Promise<{ key: string; ok: boolean; error?: string }[]> {
    if (!this.config) {
      return keys.map((key) => ({
        key,
        ok: false,
        error: "config_not_loaded",
      }));
    }

    // Read history and progress files once for all keys
    const historyPath = join(
      this.workspaceRoot,
      this.mentorPath,
      "question-history.json",
    );
    const progressPath = join(
      this.workspaceRoot,
      this.mentorPath,
      "progress.json",
    );

    let historyTopics: Set<string> | null = null;
    try {
      const raw = await readFile(historyPath, "utf-8");
      const history = parseQuestionHistory(raw);
      historyTopics = new Set(history.history.map((entry) => entry.topic));
    } catch (err: unknown) {
      if (!isFileNotFound(err)) {
        return keys.map((key) => ({
          key,
          ok: false,
          error: "read_history_failed",
        }));
      }
      historyTopics = new Set();
    }

    let progressTopics: Set<string> | null = null;
    try {
      const progressRaw = await readFile(progressPath, "utf-8");
      const rawObj = JSON.parse(progressRaw) as Record<string, unknown>;
      if (Array.isArray(rawObj.unresolved_gaps)) {
        progressTopics = new Set(
          (rawObj.unresolved_gaps as unknown[])
            .filter(
              (gap): gap is Record<string, unknown> =>
                typeof gap === "object" && gap !== null,
            )
            .map((gap) => gap.topic as string),
        );
      } else {
        progressTopics = new Set();
      }
    } catch (err: unknown) {
      if (!isFileNotFound(err)) {
        return keys.map((key) => ({
          key,
          ok: false,
          error: "read_progress_failed",
        }));
      }
      progressTopics = new Set();
    }

    // Validate each key and collect results
    const results: { key: string; ok: boolean; error?: string }[] = [];
    const keysToDelete: string[] = [];

    for (const key of keys) {
      if (!this.config.topics.some((t) => t.key === key)) {
        results.push({ key, ok: false, error: "topic_not_found" });
      } else if (historyTopics.has(key) || progressTopics.has(key)) {
        results.push({ key, ok: false, error: "has_related_data" });
      } else {
        keysToDelete.push(key);
        results.push({ key, ok: true });
      }
    }

    // Apply all deletions and save once
    if (keysToDelete.length > 0) {
      const deleteSet = new Set(keysToDelete);
      this.config = {
        ...this.config,
        topics: this.config.topics.filter((t) => !deleteSet.has(t.key)),
      };
      await this.saveConfig();
    }

    return results;
  }

  async addTopic(
    label: string,
  ): Promise<{ ok: boolean; key?: string; error?: string }> {
    const key = generateTopicKey(label);
    if (!key) {
      return {
        ok: false,
        error:
          "Label must contain at least one ASCII letter or number (A-Z, 0-9)",
      };
    }
    if (!this.config) {
      return { ok: false, error: "Config not loaded" };
    }
    if (this.config.topics.some((t) => t.key === key)) {
      return { ok: false, error: "Duplicate key" };
    }
    this.config = {
      ...this.config,
      topics: [...this.config.topics, { key, label: label.trim() }],
    };
    await this.saveConfig();
    return { ok: true, key };
  }

  async updateTopicLabel(key: string, newLabel: string): Promise<void> {
    if (!this.config) return;
    const exists = this.config.topics.some((t) => t.key === key);
    this.config = {
      ...this.config,
      topics: exists
        ? this.config.topics.map((t) =>
            t.key === key ? { ...t, label: newLabel } : t,
          )
        : [...this.config.topics, { key, label: newLabel.trim() }],
    };
    await this.saveConfig();
  }

  private async saveConfig(): Promise<void> {
    const configPath = join(this.workspaceRoot, ".mentor", "config.json");
    // Preserve unknown fields by merging into the raw JSON object
    const merged = { ...this.rawConfig, ...this.config };
    await writeFile(configPath, JSON.stringify(merged, null, 2) + "\n");
    this.rawConfig = merged;
    this.onConfigChanged?.(this.config);
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
        // globalState is newer → write to progress.json
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
        // progress.json is newer → update globalState
        await this.globalState.update("learnerProfile", fileProfile);
        this.log?.("Synced learner_profile from progress.json to globalState");
      }
      // fileTime === globalTime → no-op
    } catch (err) {
      this.log?.(`syncLearnerProfile failed: ${String(err)}`);
    }
  }

  getConfig(): MentorStudioConfig | null {
    return this.config;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
