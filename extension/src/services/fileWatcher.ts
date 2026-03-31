import type { DashboardData, MentorStudioConfig } from "@mentor-studio/shared";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import * as vscode from "vscode";
import {
  computeDashboardData,
  parseConfig,
  parseProgressData,
  parseQuestionHistory,
} from "./dataParser";

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

  constructor(
    private workspaceRoot: string,
    private mentorPath: string,
    private onDataChanged: (data: DashboardData) => void,
    private onConfigChanged?: (config: MentorStudioConfig | null) => void,
  ) {}

  async start(): Promise<void> {
    await this.loadConfig();

    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      `${this.mentorPath}/{progress,question-history}.json`,
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(
      () =>
        void this.refresh().catch((err) =>
          console.error("refresh failed", err),
        ),
    );
    watcher.onDidCreate(
      () =>
        void this.refresh().catch((err) =>
          console.error("refresh failed", err),
        ),
    );
    this.disposables.push(watcher);

    const configPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      ".mentor-studio.json",
    );
    const configWatcher =
      vscode.workspace.createFileSystemWatcher(configPattern);

    const reloadConfig = (): void => {
      void this.loadConfig()
        .then(() => {
          this.onConfigChanged?.(this.config);
        })
        .catch((err) => console.error("loadConfig failed", err));
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
      const configPath = join(this.workspaceRoot, ".mentor-studio.json");
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
      return;
    }

    let historyRaw: string | null = null;
    try {
      historyRaw = await readFile(historyPath, "utf-8");
    } catch {
      // question-history.json may not exist yet — use empty history
    }

    const history = parseQuestionHistory(historyRaw ?? '{"history":[]}');
    const topics = this.config?.topics ?? [];
    const data = computeDashboardData(progress, history, topics);
    this.onDataChanged(data);
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

    if (!this.config) return;
    this.config = {
      ...this.config,
      topics: this.config.topics.filter((t) => t.key !== fromKey),
    };
    await this.saveConfig();
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
    const configPath = join(this.workspaceRoot, ".mentor-studio.json");
    // Preserve unknown fields by merging into the raw JSON object
    const merged = { ...this.rawConfig, ...this.config };
    await writeFile(configPath, JSON.stringify(merged, null, 2) + "\n");
    this.rawConfig = merged;
    this.onConfigChanged?.(this.config);
    await this.refresh();
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
