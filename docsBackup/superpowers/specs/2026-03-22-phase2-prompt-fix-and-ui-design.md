# Phase 2 — プロンプト修正 + UI改善 Design Spec

> Created: 2026-03-22

---

## 1. 概要

Phase 1 POC完了後の改善。2つのスコープに分かれる：

1. **プロンプト修正（このブランチで対応）** — question-history.json への記録漏れを修正
2. **Phase 2 機能追加** — Settingsタブ（ファイル選択UI）、Actionsタブ（prompt snippetコピー）、Overviewタブ（Topics統合）、Setupコマンド強化

---

## 2. プロンプト修正（このブランチ）

### 問題

メンターがタスク中にインラインで質問し、学習者が回答しても、question-history.json に記録されないケースがあった。原因は「misconceptionsやincorrect answersを検知したら」という曖昧なトリガー条件。

### 修正内容

#### MENTOR_RULES.md — Learning Tracker セクション

変更前:
> On detecting misconceptions or incorrect answers during learning, automatically update `docs/mentor/progress.json` (unresolved_gaps) and `docs/mentor/question-history.json`.
> When resolved correctly, record and remove from unresolved_gaps.

変更後:
> メンターが概念について質問し、学習者が回答したら、正解・不正解・「わからない」を問わず、必ず `question-history.json` に記録する。
> 不正解・「わからない」の場合は `progress.json` の `unresolved_gaps` にも追加する。
> 復習で正解した場合は `question-history.json` に `correct: true` で記録し、`unresolved_gaps` から削除する。

#### MENTOR_SKILL.md — Teaching Philosophy

変更前:
> `Concept → Question → Wait → Feedback → Code → Verify`

変更後:
> `Concept → Question → Wait → Feedback → Record → Code → Verify`
>
> - Record: 質問と回答を `question-history.json` に記録。不正解なら `unresolved_gaps` にも追加。**このステップを飛ばさないこと。**

### ポイント

- トリガーを「検知したら」→「回答があったら必ず」に変更。曖昧さを排除
- Teaching PhilosophyフローにRecordステップを明示的に追加
- 「わからない」も不正解として扱うことを明記

---

## 3. ファイル構成の整理

### 変更理由

`docs/mentor/` にデータファイルとプロンプトファイルが混在しているのを整理。ユーザーが触るもの（データ）とAIが読むもの（ルール）を分離する。

### 変更後の構成

```
docs/mentor/
├── rules/                        ← AIが読むプロンプトファイル
│   ├── MENTOR_RULES.md
│   ├── MENTOR_SKILL.md
│   ├── core-rules.md
│   └── learning-tracker-rules.md
├── progress.json                 ← データファイル
├── question-history.json
├── current-task.md               ← タスク完了時にAIが上書き
├── app-design.md                 ← ユーザーが作成（任意の場所も可）
└── learning-roadmap.md           ← ユーザーが作成（任意の場所も可）
```

### CLAUDE.md の参照パス

変更前: `@docs/mentor/MENTOR_RULES.md`
変更後: `@docs/mentor/rules/MENTOR_RULES.md`

---

## 4. タブ構成の変更

### 変更前

`[Overview] [Topics] [Actions]`

### 変更後

`[Actions] [Overview] [Settings]`

- **Actions** — prompt snippetコピー。使用頻度が最も高いため左端に配置
- **Overview** — 既存の内容 + 旧Topicsの内容（Topic別正答率）を下部に統合
- **Settings** — 新規。app-design / roadmap(plan) のファイルパス設定

---

## 5. Actionsタブ

### Prompt Snippets

4つの固定スニペット。カード型UIでタイトル + コピーボタン（📋）。

| タイトル | コピーされるプロンプト |
|---|---|
| Start next task | `docs/mentor/rules/MENTOR_RULES.md を読んで、次のタスクを始めてください。` |
| Review implementation | `docs/mentor/rules/MENTOR_RULES.md を読んで、現在のタスクの実装をレビューしてください。` |
| Start 復習 | `docs/mentor/rules/MENTOR_RULES.md を読んで、unresolved_gaps にある概念の復習を始めてください。` |
| Start 理解度チェック | `docs/mentor/rules/MENTOR_RULES.md を読んで、app-design と roadmap を確認し、現在のタスクに関連する理解度チェックを実施してください。` |

### 技術的な流れ

既存の `copy` メッセージタイプを再利用する。

```
ユーザーがコピーボタン押下
  → Webview: 即座にボタンを ✓ に変えてフィードバック（楽観的UI）
  → Webview: postMessage({ type: 'copy', text: '...' })
  → Extension: await vscode.env.clipboard.writeText() を実行
  → 失敗時: vscode.window.showErrorMessage() でエラー通知
```

### 補足

- プロンプト文面はコード内にハードコード（Phase 3でカスタマイズ検討）
- コピー後にユーザーがClaude Codeのチャットにペーストして実行する前提
- 既知の制約: スニペット内のパス `docs/mentor/rules/MENTOR_RULES.md` はハードコード。`mentorFilesPath` 設定をカスタマイズしているユーザーには合わない可能性がある。Phase 3で動的生成を検討

---

## 6. Overviewタブ（Topics統合）

### レイアウト

```
┌──────────────────────────┐
│ Overview                  │
│                           │
│ 📊 Overall                │
│ ┌───────────────────────┐ │
│ │ 正答率  63%            │ │
│ │ ████████░░░░  12/19    │ │
│ └───────────────────────┘ │
│                           │
│ ⚠ Unresolved Gaps (3)     │
│ ┌───────────────────────┐ │
│ │ typescript              │
│ │  • Partial<T> の定義    │
│ │ react                   │
│ │  • useState lazy init   │
│ └───────────────────────┘ │
│                           │
│ 📚 Topics                 │
│ ┌───────────────────────┐ │
│ │ auth       ████░ 75%   │ │
│ │ typescript ██░░░ 50%   │ │
│ │ database   ██░░░ 40%   │ │
│ └───────────────────────┘ │
└──────────────────────────┘
```

### 変更内容

- 旧Topicsタブのコンポーネントを Overview の下部に移動
- Topicsタブを削除
- Topic展開（クリックで各質問の正誤一覧）は省略。Phase 3で検討

---

## 7. Settingsタブ

### レイアウト

```
┌──────────────────────────┐
│ Settings                  │
│                           │
│ 📄 App Design             │
│ ┌───────────────────────┐ │
│ │ docs/mentor/app-de... │ │
│ │            [Change] ✕ │ │
│ └───────────────────────┘ │
│                           │
│ 📄 Roadmap / Plan         │
│ ┌───────────────────────┐ │
│ │ ⚠ 未設定              │ │
│ │ [Select File]         │ │
│ │ [Copy prompt to       │ │
│ │  create one]     📋   │ │
│ └───────────────────────┘ │
└──────────────────────────┘
```

### 各設定項目の状態

| 状態 | 表示 |
|---|---|
| 未設定 | `⚠ 未設定` + `[Select File]` + プロンプトコピーボタン |
| 設定済み | ファイルパス表示 + `[Change]` + `✕`（クリア） |
| ファイルが見つからない | `⚠ File not found: path/...` + `[Select File]` |

### データ保存先

`.mentor-studio.json` に `mentorFiles` フィールドを追加：

```json
{
  "repositoryName": "my-project",
  "topics": [...],
  "mentorFiles": {
    "appDesign": "docs/mentor/app-design.md",
    "roadmap": null
  }
}
```

### 後方互換性

`mentorFiles` は optional フィールドとする。Phase 1 で作成された `.mentor-studio.json` にはこのフィールドが存在しないため：

- 型定義: `mentorFiles?: { appDesign: string | null; roadmap: string | null }`
- 読み込み時に `mentorFiles` が未定義の場合、`{ appDesign: null, roadmap: null }` として扱う
- Settings タブでは両方「未設定」と表示される

### 技術的な流れ

```
[Select File] ボタン押下
  → Webview: postMessage({ type: 'selectFile', field: 'appDesign' })
  → Extension: vscode.window.showOpenDialog() を表示
  → ユーザーがファイルを選択
  → Extension: ワークスペース内のファイルか検証（外部ファイルはエラー表示）
  → Extension: ワークスペース相対パスに変換して .mentor-studio.json を更新
  → Extension: postMessage({ type: 'config', data: {...} })
  → Webview: UIを更新
```

### パス保存ルール

- パスはワークスペースルートからの相対パスで保存する
- ユーザーがワークスペース外のファイルを選択した場合、エラーメッセージを表示して拒否する

### 型定義の変更

`MentorStudioConfig` に `mentorFiles` を追加：

```typescript
export interface MentorStudioConfig {
  repositoryName: string;
  topics: TopicConfig[];
  mentorFiles?: {
    appDesign: string | null;
    roadmap: string | null;
  };
}
```

`WebviewMessage` に新規メッセージタイプを追加：

```typescript
export type WebviewMessage =
  | { type: "copy"; text: string }
  | { type: "ready" }
  | { type: "selectFile"; field: "appDesign" | "roadmap" }
  | { type: "clearFile"; field: "appDesign" | "roadmap" };
```

`.mentor-studio.json` のスキーマ移行は不要。`mentorFiles` が存在しない場合はランタイムでデフォルト値（両方 null）を適用する。

### 未設定時のコピー用プロンプト

**App Design:**
> `docs/mentor/rules/MENTOR_RULES.md を読んで、このプロジェクトの app-design.md を作成してください。不足している情報があればユーザーに質問してください。`

**Roadmap / Plan:**
> `docs/mentor/rules/MENTOR_RULES.md を読んで、このプロジェクトの learning-roadmap.md を作成してください。不足している情報があればユーザーに質問してください。`

---

## 8. Setupコマンド強化

### 生成ファイル一覧

| ファイル | 内容 |
|---|---|
| `.mentor-studio.json` | プロジェクト設定（topics, mentorFiles） |
| `docs/mentor/rules/MENTOR_RULES.md` | メンタールール（エントリポイント） |
| `docs/mentor/rules/MENTOR_SKILL.md` | メンタースキル定義 |
| `docs/mentor/rules/core-rules.md` | Teaching Philosophy等 |
| `docs/mentor/rules/learning-tracker-rules.md` | 記録トリガーとデータ形式 |
| `docs/mentor/progress.json` | 初期状態の進捗データ |
| `docs/mentor/question-history.json` | 空の履歴 |
| `docs/mentor/current-task.md` | プレースホルダー（「タスク未設定」） |
| `CLAUDE.md` への追記 | `@docs/mentor/rules/MENTOR_RULES.md`（ユーザー確認あり） |

### 再実行時の挙動

`.mentor-studio.json` が既に存在する場合でも、Setup コマンドは不足しているファイルのみ追加する。既存ファイルは上書きしない。これにより Phase 1 → Phase 2 へのアップグレードが可能。

### ディレクトリ作成

ファイル書き込み前に `vscode.workspace.fs.createDirectory()` で中間ディレクトリ（`docs/mentor/`, `docs/mentor/rules/`）を作成する。`createDirectory` は既存ディレクトリに対しても安全に動作する。

### CLAUDE.md 追記フロー

```
Setup実行
  → CLAUDE.md が存在するか確認
  → 存在する場合: 末尾に追記していいか確認ダイアログ
  → 存在しない場合: 新規作成していいか確認ダイアログ
  → ユーザーが承認 → 追記/作成
  → ユーザーが拒否 → スキップ（後で手動追記可能）
```

---

## 9. メッセージプロトコル追加

Webview ↔ Extension 間の postMessage。既存のメッセージタイプを再利用し、新規追加は最小限にする。

### Webview → Extension

| type | payload | 用途 | 備考 |
|---|---|---|---|
| `copy` | `{ text: string }` | プロンプトをクリップボードにコピー | 既存。再利用 |
| `selectFile` | `{ field: 'appDesign' \| 'roadmap' }` | ファイルピッカーを開く | 新規 |
| `clearFile` | `{ field: 'appDesign' \| 'roadmap' }` | ファイル設定をクリア | 新規 |

### Extension → Webview

| type | payload | 用途 | 備考 |
|---|---|---|---|
| `config` | `{ data: MentorStudioConfig }` | 設定データの送信・更新 | 既存。再利用 |

### 補足

- コピーのUI フィードバック（✓表示）は Webview 側で楽観的に処理する（`copy` 送信と同時にボタンを変更）
- ファイル選択・クリア後の設定反映は、既存の `config` メッセージタイプで最新の `MentorStudioConfig` を送信する

---

## 10. 設計判断の記録

| 判断 | 選択 | 理由 |
|---|---|---|
| プロンプト記録トリガー | 全Q&Aを記録 + フローにRecordステップ追加 | 片方だけだと漏れるリスクが残る |
| プロンプトファイル配置 | `docs/mentor/rules/` サブフォルダ | データファイルとの分離。ユーザーが触る必要のないファイルを整理 |
| タブ構成 | `[Actions] [Overview] [Settings]` | Actions の使用頻度が高いため左端。Topics を Overview に統合してタブ数維持 |
| ファイル選択UI | VSCode標準ファイルピッカー | ネイティブUXで確実。パス入力ミスも防げる |
| Prompt snippet | コード内ハードコード | Phase 3でカスタマイズ検討。現時点では4つ固定で十分 |
| 設定保存先 | `.mentor-studio.json` | 既存の設定ファイルを拡張。新規ファイル不要 |
