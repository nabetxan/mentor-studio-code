import type { DashboardData, MentorStudioConfig } from "@mentor-studio/shared";
import { readFile } from "fs/promises";
import { join } from "path";
import * as vscode from "vscode";
import {
  computeDashboardData,
  parseProgressData,
  parseQuestionHistory,
} from "./dataParser";

export class FileWatcherService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private config: MentorStudioConfig | null = null;

  constructor(
    private workspaceRoot: string,
    private mentorPath: string,
    private onDataChanged: (data: DashboardData) => void,
  ) {}

  async start(): Promise<void> {
    await this.loadConfig();

    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      `${this.mentorPath}/{progress,question-history}.json`,
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(() => this.refresh());
    watcher.onDidCreate(() => this.refresh());
    this.disposables.push(watcher);

    await this.refresh();
  }

  private async loadConfig(): Promise<void> {
    try {
      const configPath = join(this.workspaceRoot, ".mentor-studio.json");
      const raw = await readFile(configPath, "utf-8");
      this.config = JSON.parse(raw) as MentorStudioConfig;
    } catch {
      this.config = null;
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

    try {
      const [progressRaw, historyRaw] = await Promise.all([
        readFile(progressPath, "utf-8"),
        readFile(historyPath, "utf-8"),
      ]);

      const progress = parseProgressData(progressRaw);
      if (!progress) {
        return;
      }

      const history = parseQuestionHistory(historyRaw);
      const topics = this.config?.topics ?? [];
      const data = computeDashboardData(progress, history, topics);
      this.onDataChanged(data);
    } catch {
      // Files may not exist yet
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
