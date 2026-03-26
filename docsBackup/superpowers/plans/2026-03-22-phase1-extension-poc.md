# Mentor Studio Code — Phase 1 (POC) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VSCode Extension that monitors local mentor JSON files and displays a learning dashboard sidebar with stats, topic breakdown, and action prompts.

**Architecture:** Monorepo (npm workspaces) with a shared types package and the extension package. The extension uses `vscode.workspace.createFileSystemWatcher` to detect changes to `progress.json` and `question-history.json`, parses them, computes stats, and sends data via `postMessage` to a React webview sidebar. No backend in Phase 1.

**Tech Stack:** VSCode Extension API, TypeScript, React 18, esbuild, vitest

**Spec:** `docs/superpowers/specs/2026-03-22-mentor-studio-code-design.md`

**Language policy:** AI-facing files (MENTOR_RULES.md, MENTOR_SKILL.md, core-rules.md, task-management.md, learning-tracker-rules.md) in English for token efficiency. User-facing docs (learning-roadmap.md, current-task.md, app-design.md, question data) in user's language.

---

## File Structure

```
mentor-studio-code/
├── package.json                          ← Root (npm workspaces)
├── tsconfig.base.json                    ← Shared TS compiler options
├── .gitignore
├── .mentor-studio.json                   ← Project config (topic list)
├── CLAUDE.md                             ← Claude Code instructions
├── extension/
│   ├── package.json                      ← Extension manifest (contributes, activationEvents)
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── esbuild.config.mjs               ← Bundle extension → dist/extension.js
│   ├── src/
│   │   ├── extension.ts                  ← activate() / deactivate()
│   │   ├── commands/
│   │   │   └── setupMentor.ts            ← Generate mentor files + config
│   │   ├── services/
│   │   │   ├── fileWatcher.ts            ← Watch JSON files, emit parsed data
│   │   │   └── dataParser.ts             ← Parse JSON files, compute dashboard stats
│   │   ├── views/
│   │   │   └── sidebarProvider.ts        ← WebviewViewProvider for sidebar
│   │   └── utils/
│   │       └── nonce.ts                  ← CSP nonce generator
│   └── test/
│       └── dataParser.test.ts            ← Unit tests for parsing + stats
├── extension/webview/
│   ├── package.json                      ← React dependencies
│   ├── tsconfig.json
│   ├── esbuild.config.mjs               ← Bundle React app → dist/webview.js + webview.css
│   └── src/
│       ├── index.tsx                     ← React entry point
│       ├── App.tsx                       ← Tab navigation shell
│       ├── vscodeApi.ts                  ← acquireVsCodeApi wrapper + message helpers
│       ├── components/
│       │   ├── Overview.tsx              ← Overall stats + unresolved gaps
│       │   ├── Topics.tsx                ← Per-topic breakdown with expand/collapse
│       │   └── Actions.tsx               ← Copyable prompt snippets
│       └── styles/
│           └── main.css                  ← Dashboard styles (VSCode theme vars)
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                  ← Re-export all types
│           └── types.ts                  ← All shared type definitions
└── docs/
    ├── mentor/                           ← Mentor system files (Claude Code manages)
    └── superpowers/
        ├── specs/                        ← PRD
        └── plans/                        ← This file
```

---

## Chunk 1: Foundation

### Task 1: Mentor System Setup

**Files:**
- Create: `docs/mentor/MENTOR_RULES.md`
- Append to: `CLAUDE.md`


- [ ] **Step 1: Create docs/mentor/MENTOR_RULES.md**

This file contains the project-specific mentor configuration. The setup command will generate a template version of this for new projects.

```markdown
# Mentor Studio Code

## Role

Act as a mentor: teach web development by building this app together.
Answer questions and guide learning.

Mentor skill: `@docs/mentor/MENTOR_SKILL.md`

## Conventions

- TypeScript: never use `any`
- CSS: plain CSS only in Webview (no libraries)
- Extension: VSCode Extension API only
- Build: esbuild

## Learning Tracker

On detecting misconceptions or incorrect answers during learning, automatically update `docs/mentor/progress.json` (unresolved_gaps) and `docs/mentor/question-history.json`.
When resolved correctly, record and remove from unresolved_gaps.
Check format only when needed: `docs/mentor/learning-tracker-rules.md`

## Session Start

1. Read `docs/mentor/progress.json` — check current_task, resume_context
2. Read `docs/mentor/current-task.md` (current task content is here)
3. Do NOT load other documents at this point

## Docs (load on demand only)

- App design: [docs/mentor/app-design.md](docs/mentor/app-design.md) — only when implementation reference is needed
- Learning roadmap: [docs/mentor/learning-roadmap.md](docs/mentor/learning-roadmap.md) — only when looking up next task after completion
- Task management: [docs/mentor/task-management.md](docs/mentor/task-management.md) — only when checking task completion/start procedures
```

- [ ] **Step 2: Add mentor reference to CLAUDE.md**

Add this line to `CLAUDE.md` (CLAUDE.md is currently empty; in general, append without overwriting existing content):
```
@docs/mentor/MENTOR_RULES.md
```

---

### Task 2: Root Project Scaffold

**Files:**

- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "mentor-studio-code",
  "private": true,
  "workspaces": ["packages/*", "extension", "extension/webview"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
*.vsix
.DS_Store
```

- [ ] **Step 4: Verify workspace setup**

Run: `npm install`
Expected: No errors, node_modules created at root

---

### Task 3: Shared Types Package

**Files:**

- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@mentor-studio/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/shared/src/types.ts**

```typescript
// === Progress data (matches docs/mentor/progress.json) ===

export interface UnresolvedGap {
  concept: string;
  topic: string;
  first_missed: string;
  task: string;
  note: string;
}

export interface ProgressData {
  version: string;
  current_task: string;
  current_step: number | null;
  next_suggest: string;
  resume_context: string;
  completed_tasks: string[];
  skipped_tasks: string[];
  in_progress: string[];
  unresolved_gaps: UnresolvedGap[];
}

// === Question history (matches docs/mentor/question-history.json) ===

export interface QuestionHistoryEntry {
  timestamp: string;
  taskId: string;
  topic: string;
  concept: string;
  question: string;
  userAnswer: string;
  isCorrect: boolean;
}

export interface QuestionHistory {
  history: QuestionHistoryEntry[];
}

// === Project config (matches .mentor-studio.json) ===

export interface TopicConfig {
  key: string;
  label: string;
}

export interface MentorStudioConfig {
  repositoryName: string;
  topics: TopicConfig[];
}

// === Dashboard stats (computed by extension, sent to webview) ===

export interface TopicStats {
  topic: string;
  label: string;
  total: number;
  correct: number;
  rate: number;
}

export interface DashboardData {
  totalQuestions: number;
  correctRate: number;
  byTopic: TopicStats[];
  unresolvedGaps: UnresolvedGap[];
  completedTasks: string[];
  currentTask: string;
}

// === Extension <-> Webview message protocol ===

export type ExtensionMessage =
  | { type: "update"; data: DashboardData }
  | { type: "config"; data: MentorStudioConfig }
  | { type: "noConfig" };

export type WebviewMessage = { type: "copy"; text: string } | { type: "ready" };
```

- [ ] **Step 4: Create packages/shared/src/index.ts**

```typescript
export type {
  UnresolvedGap,
  ProgressData,
  QuestionHistoryEntry,
  QuestionHistory,
  TopicConfig,
  MentorStudioConfig,
  TopicStats,
  DashboardData,
  ExtensionMessage,
  WebviewMessage,
} from "./types";
```

- [ ] **Step 5: Install and verify types compile**

Run: `npm install && cd packages/shared && npx tsc --noEmit`
Expected: No type errors

---

## Chunk 2: Extension Core

### Task 4: Extension Scaffold

**Files:**

- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/esbuild.config.mjs`
- Create: `extension/src/extension.ts`

- [ ] **Step 1: Create extension/package.json**

```json
{
  "name": "mentor-studio",
  "displayName": "Mentor Studio",
  "description": "Learning dashboard for AI mentor sessions",
  "version": "0.0.1",
  "publisher": "kaori",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Education"],
  "activationEvents": ["workspaceContains:.mentor-studio.json"],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "mentor-studio",
          "title": "Mentor Studio",
          "icon": "$(mortar-board)"
        }
      ]
    },
    "views": {
      "mentor-studio": [
        {
          "type": "webview",
          "id": "mentor-studio.sidebar",
          "name": "Dashboard"
        }
      ]
    },
    "commands": [
      {
        "command": "mentor-studio.setup",
        "title": "Setup Mentor",
        "category": "Mentor Studio"
      }
    ],
    "configuration": {
      "title": "Mentor Studio",
      "properties": {
        "mentor-studio.mentorFilesPath": {
          "type": "string",
          "default": "docs/mentor",
          "description": "Path to mentor data files relative to workspace root"
        }
      }
    }
  },
  "scripts": {
    "build": "node esbuild.config.mjs",
    "watch": "node esbuild.config.mjs --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@mentor-studio/shared": "*"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create extension/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"]
  },
  "include": ["src"],
  "exclude": ["test"]
}
```

- [ ] **Step 3: Create extension/esbuild.config.mjs**

```javascript
import { build, context } from "esbuild";

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(options);
  console.log("Build complete");
}
```

- [ ] **Step 4: Create extension/src/extension.ts (stub)**

```typescript
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
```

- [ ] **Step 5: Install dependencies and build**

Run: `npm install && cd extension && npm run build`
Expected: `dist/extension.js` created with no errors

---

### Task 5: Data Parser (TDD)

**Files:**

- Create: `extension/vitest.config.ts`
- Create: `extension/test/dataParser.test.ts`
- Create: `extension/src/services/dataParser.ts`

- [ ] **Step 1: Create vitest config**

Create `extension/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write failing tests**

Create `extension/test/dataParser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  parseProgressData,
  parseQuestionHistory,
  computeDashboardData,
} from "../src/services/dataParser";
import type { TopicConfig } from "@mentor-studio/shared";

describe("parseProgressData", () => {
  it("parses valid progress JSON", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_task: "3",
      current_step: null,
      next_suggest: "task-4",
      resume_context: "Finished task 2",
      completed_tasks: ["1", "2"],
      skipped_tasks: [],
      in_progress: [],
      unresolved_gaps: [],
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.current_task).toBe("3");
    expect(result!.completed_tasks).toEqual(["1", "2"]);
  });

  it("returns null for invalid JSON", () => {
    expect(parseProgressData("not json")).toBeNull();
  });

  it("returns null for missing required fields", () => {
    expect(parseProgressData(JSON.stringify({ version: "2.0" }))).toBeNull();
  });
});

describe("parseQuestionHistory", () => {
  it("parses valid question history", () => {
    const json = JSON.stringify({
      history: [
        {
          timestamp: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "interface vs type",
          question: "What is the difference?",
          userAnswer: "interface can extend",
          isCorrect: false,
        },
      ],
    });
    const result = parseQuestionHistory(json);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].isCorrect).toBe(false);
  });

  it("returns empty history for invalid JSON", () => {
    expect(parseQuestionHistory("broken").history).toEqual([]);
  });
});

describe("computeDashboardData", () => {
  const topics: TopicConfig[] = [
    { key: "typescript", label: "TypeScript" },
    { key: "react", label: "React" },
  ];

  it("computes correct stats from history and progress", () => {
    const progress = {
      version: "2.0",
      current_task: "2",
      current_step: null,
      next_suggest: "",
      resume_context: "",
      completed_tasks: ["1"],
      skipped_tasks: [],
      in_progress: [],
      unresolved_gaps: [
        {
          concept: "interface vs type",
          topic: "typescript",
          first_missed: "2026-03-01",
          task: "task-1",
          note: "confused extends vs &",
        },
      ],
    };
    const history = {
      history: [
        {
          timestamp: "2026-03-01T10:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "interface vs type",
          question: "Difference?",
          userAnswer: "extends",
          isCorrect: false,
        },
        {
          timestamp: "2026-03-01T11:00:00Z",
          taskId: "task-1",
          topic: "typescript",
          concept: "generics",
          question: "What are generics?",
          userAnswer: "Type parameters",
          isCorrect: true,
        },
        {
          timestamp: "2026-03-02T10:00:00Z",
          taskId: "task-1",
          topic: "react",
          concept: "useState",
          question: "What does useState return?",
          userAnswer: "[value, setter]",
          isCorrect: true,
        },
      ],
    };

    const result = computeDashboardData(progress, history, topics);
    expect(result.totalQuestions).toBe(3);
    expect(result.correctRate).toBeCloseTo(0.667, 2);
    expect(result.byTopic).toHaveLength(2);

    const ts = result.byTopic.find((t) => t.topic === "typescript");
    expect(ts?.total).toBe(2);
    expect(ts?.correct).toBe(1);
    expect(ts?.rate).toBe(0.5);

    const react = result.byTopic.find((t) => t.topic === "react");
    expect(react?.total).toBe(1);
    expect(react?.correct).toBe(1);

    expect(result.unresolvedGaps).toHaveLength(1);
    expect(result.currentTask).toBe("2");
  });

  it("handles empty history", () => {
    const progress = {
      version: "2.0",
      current_task: "1",
      current_step: null,
      next_suggest: "",
      resume_context: "",
      completed_tasks: [],
      skipped_tasks: [],
      in_progress: [],
      unresolved_gaps: [],
    };
    const result = computeDashboardData(progress, { history: [] }, topics);
    expect(result.totalQuestions).toBe(0);
    expect(result.correctRate).toBe(0);
    expect(result.byTopic).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd extension && npx vitest run`
Expected: FAIL — `parseProgressData` is not defined

- [ ] **Step 4: Implement dataParser.ts**

Create `extension/src/services/dataParser.ts`:

```typescript
import type {
  ProgressData,
  QuestionHistory,
  DashboardData,
  TopicConfig,
  TopicStats,
} from "@mentor-studio/shared";

export function parseProgressData(raw: string): ProgressData | null {
  try {
    const data = JSON.parse(raw);
    if (
      typeof data.version !== "string" ||
      typeof data.current_task !== "string" ||
      !Array.isArray(data.completed_tasks)
    ) {
      return null;
    }
    return data as ProgressData;
  } catch {
    return null;
  }
}

export function parseQuestionHistory(raw: string): QuestionHistory {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.history)) {
      return { history: [] };
    }
    return data as QuestionHistory;
  } catch {
    return { history: [] };
  }
}

export function computeDashboardData(
  progress: ProgressData,
  history: QuestionHistory,
  topics: TopicConfig[],
): DashboardData {
  const entries = history.history;
  const totalQuestions = entries.length;
  const correctCount = entries.filter((e) => e.isCorrect).length;
  const correctRate = totalQuestions > 0 ? correctCount / totalQuestions : 0;

  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const entry of entries) {
    const existing = topicMap.get(entry.topic) ?? { correct: 0, total: 0 };
    existing.total += 1;
    if (entry.isCorrect) {
      existing.correct += 1;
    }
    topicMap.set(entry.topic, existing);
  }

  const byTopic: TopicStats[] = [];
  for (const [topicKey, stats] of topicMap) {
    const config = topics.find((t) => t.key === topicKey);
    byTopic.push({
      topic: topicKey,
      label: config?.label ?? topicKey,
      total: stats.total,
      correct: stats.correct,
      rate: stats.total > 0 ? stats.correct / stats.total : 0,
    });
  }

  byTopic.sort((a, b) => a.rate - b.rate);

  return {
    totalQuestions,
    correctRate,
    byTopic,
    unresolvedGaps: progress.unresolved_gaps,
    completedTasks: progress.completed_tasks,
    currentTask: progress.current_task,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd extension && npx vitest run`
Expected: All tests PASS

---

### Task 6: File Watcher Service

**Files:**

- Create: `extension/src/services/fileWatcher.ts`

- [ ] **Step 1: Create fileWatcher.ts**

```typescript
import * as vscode from "vscode";
import { readFile } from "fs/promises";
import { join } from "path";
import type { MentorStudioConfig, DashboardData } from "@mentor-studio/shared";
import {
  parseProgressData,
  parseQuestionHistory,
  computeDashboardData,
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
```

- [ ] **Step 2: Build to verify compilation**

Run: `cd extension && npm run build`
Expected: Build succeeds

---

## Chunk 3: Sidebar Dashboard

### Task 7: Sidebar Webview Provider

**Files:**

- Create: `extension/src/utils/nonce.ts`
- Create: `extension/src/views/sidebarProvider.ts`

- [ ] **Step 1: Create nonce.ts**

```typescript
export function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
```

- [ ] **Step 2: Create sidebarProvider.ts**

```typescript
import * as vscode from "vscode";
import { getNonce } from "../utils/nonce";
import type {
  DashboardData,
  ExtensionMessage,
  MentorStudioConfig,
  WebviewMessage,
} from "@mentor-studio/shared";

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

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      if (message.type === "ready") {
        this.flushState();
      } else if (message.type === "copy") {
        vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage("Copied to clipboard");
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
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
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
```

- [ ] **Step 3: Build to verify compilation**

Run: `cd extension && npm run build`
Expected: Build succeeds

---

### Task 8: Webview React App Setup

**Files:**

- Create: `extension/webview/package.json`
- Create: `extension/webview/tsconfig.json`
- Create: `extension/webview/esbuild.config.mjs`
- Create: `extension/webview/src/index.tsx`
- Create: `extension/webview/src/vscodeApi.ts`
- Create: `extension/webview/src/App.tsx`
- Create: `extension/webview/src/styles/main.css`

- [ ] **Step 1: Create webview/package.json**

```json
{
  "name": "@mentor-studio/webview",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "node esbuild.config.mjs",
    "watch": "node esbuild.config.mjs --watch"
  },
  "dependencies": {
    "@mentor-studio/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create webview/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create webview/esbuild.config.mjs**

```javascript
import { build, context } from "esbuild";

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/index.tsx"],
  bundle: true,
  outfile: "dist/webview.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  jsx: "automatic",
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(options);
  console.log("Webview build complete");
}
```

- [ ] **Step 4: Create webview/src/vscodeApi.ts**

```typescript
import type { ExtensionMessage, WebviewMessage } from "@mentor-studio/shared";

interface VSCodeApi {
  postMessage(message: WebviewMessage): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

const vscode: VSCodeApi =
  (globalThis as Record<string, unknown>).acquireVsCodeApi !== undefined
    ? (globalThis as { acquireVsCodeApi: () => VSCodeApi }).acquireVsCodeApi()
    : { postMessage: () => {}, getState: () => undefined, setState: () => {} };

export function postMessage(message: WebviewMessage): void {
  vscode.postMessage(message);
}

export function onMessage(
  handler: (message: ExtensionMessage) => void,
): () => void {
  const listener = (event: MessageEvent<ExtensionMessage>) => {
    handler(event.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
```

- [ ] **Step 5: Create webview/src/App.tsx**

```tsx
import { useState, useEffect } from "react";
import type {
  DashboardData,
  MentorStudioConfig,
  ExtensionMessage,
} from "@mentor-studio/shared";
import { onMessage, postMessage } from "./vscodeApi";
import { Overview } from "./components/Overview";
import { Topics } from "./components/Topics";
import { Actions } from "./components/Actions";

type Tab = "overview" | "topics" | "actions";

export function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<MentorStudioConfig | null>(null);
  const [hasConfig, setHasConfig] = useState(true);

  useEffect(() => {
    const cleanup = onMessage((message: ExtensionMessage) => {
      switch (message.type) {
        case "update":
          setData(message.data);
          break;
        case "config":
          setConfig(message.data);
          setHasConfig(true);
          break;
        case "noConfig":
          setHasConfig(false);
          break;
      }
    });

    postMessage({ type: "ready" });
    return cleanup;
  }, []);

  if (!hasConfig) {
    return (
      <div className="no-config">
        <p>
          No <code>.mentor-studio.json</code> found.
        </p>
        <p>
          Run &quot;Mentor Studio: Setup Mentor&quot; from the command palette.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={tab === "topics" ? "active" : ""}
          onClick={() => setTab("topics")}
        >
          Topics
        </button>
        <button
          className={tab === "actions" ? "active" : ""}
          onClick={() => setTab("actions")}
        >
          Actions
        </button>
      </nav>
      <main className="content">
        {tab === "overview" && <Overview data={data} />}
        {tab === "topics" && <Topics data={data} />}
        {tab === "actions" && <Actions config={config} />}
      </main>
      <footer className="status">
        {data ? "✓ Local data loaded" : "Loading..."}
      </footer>
    </div>
  );
}
```

- [ ] **Step 6: Create webview/src/index.tsx**

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/main.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
```

- [ ] **Step 7: Create webview/src/styles/main.css**

```css
:root {
  --vscode-font: var(--vscode-font-family, system-ui, sans-serif);
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--vscode-font);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--vscode-panel-border);
  padding: 0 8px;
}

.tabs button {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--vscode-foreground);
  padding: 8px 12px;
  cursor: pointer;
  font-size: inherit;
  opacity: 0.7;
}

.tabs button.active {
  opacity: 1;
  border-bottom-color: var(--vscode-focusBorder);
}

.tabs button:hover {
  opacity: 1;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.status {
  padding: 6px 12px;
  font-size: 11px;
  opacity: 0.6;
  border-top: 1px solid var(--vscode-panel-border);
}

.stat-card {
  background: var(--vscode-editor-background);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
}

.progress-bar {
  height: 6px;
  background: var(--vscode-progressBar-background, #0078d4);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-track {
  height: 6px;
  background: var(--vscode-input-background);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 6px;
}

.gap-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.gap-item {
  padding: 4px 0;
  font-size: 12px;
}

.topic-group {
  margin-bottom: 12px;
}

.topic-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 6px 0;
}

.topic-detail {
  padding-left: 12px;
}

.action-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--vscode-editor-background);
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 6px;
  cursor: pointer;
}

.action-card:hover {
  background: var(--vscode-list-hoverBackground);
}

.no-config {
  padding: 24px 12px;
  text-align: center;
  opacity: 0.8;
}

.no-config code {
  background: var(--vscode-textCodeBlock-background);
  padding: 2px 4px;
  border-radius: 2px;
}

.empty {
  opacity: 0.5;
  text-align: center;
  padding: 24px 0;
}
```

- [ ] **Step 8: Install dependencies and build**

Run: `npm install && cd extension/webview && npm run build`
Expected: `dist/webview.js` and `dist/webview.css` created

---

### Task 9: Overview Tab

**Files:**

- Create: `extension/webview/src/components/Overview.tsx`

- [ ] **Step 1: Create Overview.tsx**

```tsx
import type { DashboardData } from "@mentor-studio/shared";

interface Props {
  data: DashboardData | null;
}

export function Overview({ data }: Props) {
  if (!data) {
    return <div className="empty">Waiting for data...</div>;
  }

  const percentage = Math.round(data.correctRate * 100);
  const correctCount = data.byTopic.reduce((sum, t) => sum + t.correct, 0);

  return (
    <div>
      <div className="stat-card">
        <div style={{ fontSize: "11px", opacity: 0.7 }}>
          Overall Correct Rate
        </div>
        <div style={{ fontSize: "20px", fontWeight: "bold", margin: "4px 0" }}>
          {percentage}%
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${percentage}%` }} />
        </div>
        <div style={{ fontSize: "11px", marginTop: "4px", opacity: 0.6 }}>
          {correctCount}/{data.totalQuestions} correct
        </div>
      </div>

      {data.unresolvedGaps.length > 0 && (
        <div className="stat-card">
          <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "8px" }}>
            Unresolved Gaps ({data.unresolvedGaps.length})
          </div>
          <ul className="gap-list">
            {data.unresolvedGaps.map((gap, i) => (
              <li key={i} className="gap-item">
                <span style={{ opacity: 0.5, marginRight: "6px" }}>
                  {gap.topic}
                </span>
                {gap.concept}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="stat-card">
        <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "4px" }}>
          Progress
        </div>
        <div style={{ fontSize: "13px" }}>Current task: {data.currentTask}</div>
        <div style={{ fontSize: "12px", opacity: 0.6 }}>
          {data.completedTasks.length} tasks completed
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd extension/webview && npm run build`
Expected: Build succeeds

---

### Task 10: Topics Tab + Actions Tab

**Files:**

- Create: `extension/webview/src/components/Topics.tsx`
- Create: `extension/webview/src/components/Actions.tsx`

- [ ] **Step 1: Create Topics.tsx**

```tsx
import { useState } from "react";
import type { DashboardData, TopicStats } from "@mentor-studio/shared";

interface Props {
  data: DashboardData | null;
}

export function Topics({ data }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!data || data.byTopic.length === 0) {
    return <div className="empty">No questions recorded yet.</div>;
  }

  const toggle = (topic: string) => {
    setExpanded(expanded === topic ? null : topic);
  };

  return (
    <div>
      {data.byTopic.map((t: TopicStats) => {
        const percentage = Math.round(t.rate * 100);
        const isOpen = expanded === t.topic;

        return (
          <div key={t.topic} className="topic-group">
            <div className="topic-header" onClick={() => toggle(t.topic)}>
              <span>
                {isOpen ? "▼" : "▶"} {t.label}
              </span>
              <span>
                {percentage}% ({t.correct}/{t.total})
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${percentage}%` }}
              />
            </div>
            {isOpen && (
              <div className="topic-detail">
                {data.unresolvedGaps
                  .filter((g) => g.topic === t.topic)
                  .map((g, i) => (
                    <div key={i} className="gap-item">
                      ✗ {g.concept}
                    </div>
                  ))}
                {data.unresolvedGaps.filter((g) => g.topic === t.topic)
                  .length === 0 && (
                  <div className="gap-item" style={{ opacity: 0.5 }}>
                    No unresolved gaps
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create Actions.tsx**

```tsx
import type { MentorStudioConfig } from "@mentor-studio/shared";
import { postMessage } from "../vscodeApi";

interface Props {
  config: MentorStudioConfig | null;
}

const ACTIONS = [
  {
    label: "Start a quiz",
    prompt:
      "docs/mentor/MENTOR_SKILL.md を読んで、現在のタスクに関する理解度クイズを出してください。結果は question-history.json に記録してください。",
  },
  {
    label: "Review weak spots",
    prompt:
      "docs/mentor/progress.json の unresolved_gaps を確認して、苦手な概念の復習問題を出してください。",
  },
  {
    label: "Start next task",
    prompt:
      "docs/mentor/MENTOR_SKILL.md を読んで、次のタスクを始めてください。",
  },
];

export function Actions(_props: Props) {
  const handleCopy = (text: string) => {
    postMessage({ type: "copy", text });
  };

  return (
    <div>
      <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "8px" }}>
        Copy a prompt and paste it into Claude Code:
      </div>
      {ACTIONS.map((action, i) => (
        <div
          key={i}
          className="action-card"
          onClick={() => handleCopy(action.prompt)}
        >
          <span>{action.label}</span>
          <span style={{ opacity: 0.4 }}>&#x1F4CB;</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `cd extension/webview && npm run build`
Expected: Build succeeds

---

## Chunk 4: Commands & Integration

### Task 11: Setup Mentor Command

**Files:**

- Create: `extension/src/commands/setupMentor.ts`

- [ ] **Step 1: Create setupMentor.ts**

```typescript
import * as vscode from "vscode";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync, readFileSync } from "fs";

const DEFAULT_CONFIG = {
  repositoryName: "",
  topics: [
    { key: "typescript", label: "TypeScript" },
    { key: "react", label: "React" },
    { key: "backend", label: "Backend / Express" },
    { key: "database", label: "Database / Prisma" },
    { key: "auth", label: "Authentication" },
    { key: "css", label: "CSS / Styling" },
    { key: "testing", label: "Testing" },
    { key: "git", label: "Git" },
  ],
};

const INITIAL_PROGRESS = {
  version: "2.0",
  current_task: "1",
  current_step: null,
  next_suggest: "",
  resume_context: "",
  completed_tasks: [] as string[],
  skipped_tasks: [] as string[],
  in_progress: [] as string[],
  unresolved_gaps: [] as unknown[],
};

const INITIAL_HISTORY = { history: [] as unknown[] };

export async function setupMentor(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const configPath = join(workspaceRoot, ".mentor-studio.json");
  if (existsSync(configPath)) {
    vscode.window.showInformationMessage(".mentor-studio.json already exists.");
    return;
  }

  const folderName = workspaceRoot.split("/").pop() ?? "my-project";

  const mentorFilesPath = vscode.workspace
    .getConfiguration("mentor-studio")
    .get<string>("mentorFilesPath", "docs/mentor");

  const mentorDir = join(workspaceRoot, mentorFilesPath);

  await mkdir(mentorDir, { recursive: true });

  const config = { ...DEFAULT_CONFIG, repositoryName: folderName };
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  await writeFile(
    join(mentorDir, "progress.json"),
    JSON.stringify(INITIAL_PROGRESS, null, 2) + "\n",
  );
  await writeFile(
    join(mentorDir, "question-history.json"),
    JSON.stringify(INITIAL_HISTORY, null, 2) + "\n",
  );
  await writeFile(join(mentorDir, "current-task.md"), "");

  // Generate MENTOR_RULES.md (project-specific mentor config)
  const rulesPath = join(mentorDir, "MENTOR_RULES.md");
  if (!existsSync(rulesPath)) {
    await writeFile(
      rulesPath,
      [
        `# ${folderName}`,
        "",
        "## Role",
        "",
        "Act as a mentor: teach web development by building this app together.",
        "Answer questions and guide learning.",
        "",
        "Mentor skill: `@docs/mentor/MENTOR_SKILL.md`",
        "",
        "## Conventions",
        "",
        "- TypeScript: never use `any`",
        "",
        "## Learning Tracker",
        "",
        "On detecting misconceptions or incorrect answers during learning, automatically update `docs/mentor/progress.json` (unresolved_gaps) and `docs/mentor/question-history.json`.",
        "When resolved correctly, record and remove from unresolved_gaps.",
        "Check format only when needed: `docs/mentor/learning-tracker-rules.md`",
        "",
        "## Session Start",
        "",
        "1. Read `docs/mentor/progress.json` — check current_task, resume_context",
        "2. Read `docs/mentor/current-task.md` (current task content is here)",
        "3. Do NOT load other documents at this point",
        "",
        "## Docs (load on demand only)",
        "",
        "- App design: [docs/mentor/app-design.md](docs/mentor/app-design.md) — only when implementation reference is needed",
        "- Learning roadmap: [docs/mentor/learning-roadmap.md](docs/mentor/learning-roadmap.md) — only when looking up next task after completion",
        "- Task management: [docs/mentor/task-management.md](docs/mentor/task-management.md) — only when checking task completion/start procedures",
        "",
      ].join("\n"),
    );
  }

  // Generate MENTOR_SKILL.md (mentor operational details)
  const skillPath = join(mentorDir, "MENTOR_SKILL.md");
  if (!existsSync(skillPath)) {
    await writeFile(
      skillPath,
      [
        "# Mentor Skill",
        "",
        "**Role**: Educational mentor for web development through building a project",
        "**Progress**: `docs/mentor/progress.json`",
        "**Rules**: `docs/mentor/core-rules.md`",
        "",
        "## On Session Start (Default Flow)",
        "",
        "1. Read `progress.json` → Check `current_task`, `current_step`, `resume_context`, and `next_suggest`",
        "2. Load `docs/mentor/current-task.md`",
        "3. Check `unresolved_gaps` → If starting a task whose topic matches any gap, propose a quick review",
        "4. Follow the Teaching Philosophy below (core-rules.md は教え方に迷った時だけ読む)",
        "5. Ask: \"What would you like to work on today?\"",
        "",
        "## Teaching Philosophy",
        "",
        "- Concept → Question → Wait → Feedback → Code → Verify",
        "- One step at a time, never batch multiple steps",
        "- Understanding > Speed",
        "",
      ].join("\n"),
    );
  }

  // Append @docs/mentor/MENTOR_RULES.md reference to CLAUDE.md (with user confirmation)
  const updateClaude = await vscode.window.showInformationMessage(
    "Add @docs/mentor/MENTOR_RULES.md to CLAUDE.md?",
    "Yes",
    "No",
  );

  if (updateClaude === "Yes") {
    const claudeMdPath = join(workspaceRoot, "CLAUDE.md");
    const mentorRef = "\n@docs/mentor/MENTOR_RULES.md\n";
    const existing = existsSync(claudeMdPath)
      ? readFileSync(claudeMdPath, "utf-8")
      : "";
    if (!existing.includes("MENTOR_RULES.md")) {
      await writeFile(claudeMdPath, existing + mentorRef);
    }
  }

  vscode.window.showInformationMessage("Mentor Studio setup complete!");
}
```

- [ ] **Step 2: Build**

Run: `cd extension && npm run build`
Expected: Build succeeds

---

### Task 12: Integration — Wire Everything in extension.ts

**Files:**

- Modify: `extension/src/extension.ts`
- Create: `.mentor-studio.json` (for this repo)

- [ ] **Step 1: Update extension.ts to wire all services**

Replace `extension/src/extension.ts`:

```typescript
import * as vscode from "vscode";
import { existsSync } from "fs";
import { join } from "path";
import { SidebarProvider } from "./views/sidebarProvider";
import { FileWatcherService } from "./services/fileWatcher";
import { setupMentor } from "./commands/setupMentor";

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }

  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "mentor-studio.sidebar",
      sidebarProvider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("mentor-studio.setup", setupMentor),
  );

  const configPath = join(workspaceRoot, ".mentor-studio.json");
  if (existsSync(configPath)) {
    startWatcher(context, workspaceRoot, sidebarProvider);
  } else {
    sidebarProvider.sendNoConfig();
  }
}

function startWatcher(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  sidebar: SidebarProvider,
): void {
  const mentorPath = vscode.workspace
    .getConfiguration("mentor-studio")
    .get<string>("mentorFilesPath", "docs/mentor");

  const watcher = new FileWatcherService(workspaceRoot, mentorPath, (data) => {
    sidebar.sendUpdate(data);
  });

  watcher.start().then(() => {
    const config = watcher.getConfig();
    if (config) {
      sidebar.sendConfig(config);
    }
  });

  context.subscriptions.push(watcher);
}

export function deactivate(): void {
  // cleanup handled by disposables
}
```

- [ ] **Step 2: Create .mentor-studio.json for this repo**

```json
{
  "repositoryName": "mentor-studio-code",
  "topics": [
    { "key": "typescript", "label": "TypeScript" },
    { "key": "vscode_extension", "label": "VSCode Extension API" },
    { "key": "react", "label": "React" },
    { "key": "esbuild", "label": "esbuild / Bundling" },
    { "key": "testing", "label": "Testing" },
    { "key": "git", "label": "Git" }
  ]
}
```

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: All workspaces build successfully

- [ ] **Step 4: Run all tests**

Run: `cd extension && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Manual test in VSCode**

1. Open this repo in VSCode
2. Press F5 to launch Extension Development Host
3. Verify: Mentor Studio icon appears in activity bar
4. Verify: Sidebar shows dashboard with tabs (Overview/Topics/Actions)
5. Verify: Overview shows stats from progress.json
6. Verify: Edit progress.json → sidebar updates automatically
7. Verify: Actions tab copies prompt to clipboard on click

---

## Post-Implementation

After Phase 1 code is complete, update the mentor system files:

1. **`docs/mentor/learning-roadmap.md`** — Create from this plan's task breakdown, adapted as learning tasks. Reference the PRD (`docs/superpowers/specs/2026-03-22-mentor-studio-code-design.md`) for context.

2. **`docs/mentor/app-design.md`** — Derive from the PRD, simplified for in-session reference.

3. **`docs/mentor/current-task.md`** — Set to the first learning task.

4. **`docs/mentor/task-management.md`** — Update examples to use `string` type for `current_task` and `completed_tasks`.

5. **`docs/mentor/learning-tracker-rules.md`** — Update topic examples to match `.mentor-studio.json`.
