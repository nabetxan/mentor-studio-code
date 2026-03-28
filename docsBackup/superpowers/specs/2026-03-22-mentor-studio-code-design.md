# Mentor Studio Code — PRD / Design Spec

> Created: 2026-03-22

---

## 1. プロダクト概要

**Mentor Studio Code** — プログラミング学習のAIメンターセッション（Claude Code）で生まれる学習ログを自動収集し、進捗と弱点を可視化するVSCode Extension + API。

### メンターシステムの仕組み

Claude Codeが `CLAUDE.md` 経由で `docs/mentor/MENTOR_RULES.md` を読み込み、以下のフローで学習メンタリングを行う：

**教育フロー：**

1. **概念説明** — タスクに必要な概念を教える
2. **質問出題** — 理解度を確認する質問を出す
3. **回答待ち** — 学習者が回答するまで待つ
4. **評価・フィードバック** — 正誤を判定し、間違いの場合は正しい理解を説明
5. **コード実装** — 理解を確認した上で実装に進む
6. **検証** — 動作確認

**正誤判定ロジック：**

- AIが回答内容を評価し、`isCorrect: true/false` を判定
- 部分的に正しい場合や説明が不十分な場合も `correct: false`（概念の理解が目的のため）

**ローカルデータ管理（2つのJSONファイル）：**

`question-history.json` — 全質問の履歴（正解も不正解も記録）

```json
{
  "timestamp": "2026-02-28T14:30:00Z",
  "taskId": "理解度チェック-Q1",
  "topic": "typescript",
  "concept": "interface vs type の使い分け",
  "question": "interfaceとtypeの違いは？",
  "userAnswer": "interfaceはextendsできる",
  "correct": false
}
```

`progress.json` — 学習進捗の全体像

- `current_task`: 現在のタスク番号
- `completed_tasks`: 完了タスク一覧
- `resume_context`: セッション再開時の要約
- `unresolved_gaps`: 未解決の知識ギャップ（間違えた概念のリスト）

**再出題ロジック：**

- `unresolved_gaps` に記録された概念は、関連するtopicのタスク開始時にAIが復習を提案
- 復習で正解 → `question-history.json` に `isCorrect: true` で記録 & `unresolved_gaps` から削除
- 復習で不正解 → 再度記録が残り、次の関連タスクで再び出題

**Topic管理：**

- プロジェクトの設定ファイル（`.mentor-studio.json`）に定義済みtopicリストを持つ
- AIは質問記録時にこのリストから選択（表記揺れ防止）
- ユーザーがプロジェクトに応じてカスタマイズ可能

### 新規で作るもの

- VSCode Extension（サイドバーダッシュボード、file watcher、プロンプトスニペット）
- バックエンドAPI（Vercel Serverless Functions）
- データベース（Supabase PostgreSQL）
- 将来：Webダッシュボード

### ユーザー像

Claude Code Proユーザーで、AIメンターと一緒にプロジェクトベースでWeb開発を学んでいる人。

### ゴール

- 学習者が自分の弱点と進捗を一目で把握できる
- AIが過去のミスを考慮して最適な問題を出す（topicリストの一貫性により実現）
- 学習体験がVSCode内で完結（将来は詳細分析をWebダッシュボードで提供）

---

## 2. アーキテクチャ

### 全体構成

```
┌─────────────────────────────────────────────────┐
│  VSCode                                         │
│  ┌───────────────┐    ┌──────────────────────┐  │
│  │ Claude Code   │───>│ question-history.json │  │
│  │ (メンター)     │───>│ progress.json        │  │
│  └───────────────┘    └──────────┬───────────┘  │
│                                  │ file watcher  │
│  ┌───────────────────────────────▼────────────┐  │
│  │ Mentor Studio Extension                    │  │
│  │  ├─ FileWatcherService (変更検知)           │  │
│  │  ├─ ApiClient (Phase 2でAPI通信追加)        │  │
│  │  └─ SidebarViewProvider (ダッシュボード)    │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
                     │ HTTPS (Phase 2)
      ┌──────────────▼──────────────┐
      │ Vercel Serverless Functions  │
      │  ├─ POST /api/logs           │
      │  ├─ GET  /api/logs           │
      │  ├─ POST /api/projects       │
      │  ├─ GET  /api/projects       │
      │  └─ GET  /api/stats          │
      └──────────────┬──────────────┘
                     │ Prisma
      ┌──────────────▼──────────────┐
      │ Supabase PostgreSQL          │
      └─────────────────────────────┘
```

### モノレポ構成

```
mentor-studio-code/
├── extension/                ← VSCode Extension
│   ├── src/
│   │   ├── extension.ts          ← activate/deactivate
│   │   ├── services/
│   │   │   ├── fileWatcher.ts    ← JSON変更検知
│   │   │   └── apiClient.ts      ← API通信 (Phase 2)
│   │   ├── view/
│   │   │   └── sidebarProvider.ts ← Webview Provider
│   │   └── utils/
│   │       └── nonce.ts
│   ├── resources/
│   │   └── view/                 ← Webview用 React アプリ
│   │       ├── src/              ← React コンポーネント
│   │       ├── esbuild.config.mjs ← Webview バンドル設定
│   │       └── tsconfig.json
│   ├── package.json              ← Extension manifest
│   └── tsconfig.json
├── api/                      ← Vercel Serverless Functions (Phase 2)
│   ├── logs.ts
│   ├── projects.ts
│   ├── stats.ts
│   ├── auth/
│   │   ├── github.ts
│   │   └── callback.ts
│   └── _lib/
│       ├── prisma.ts
│       └── auth.ts
├── packages/
│   └── shared/               ← 共有型定義
│       ├── types.ts
│       └── package.json
├── prisma/                   ← (Phase 2)
│   └── schema.prisma
├── vercel.json               ← (Phase 2)
├── package.json              ← ルート（workspaces）
└── .mentor-studio.json       ← Topic設定（サンプル）
```

### 技術スタック

| レイヤー   | 技術                                    | Phase |
| ---------- | --------------------------------------- | ----- |
| Extension  | VSCode Extension API, TypeScript        | 1     |
| Webview UI | React + TypeScript, esbuild でバンドル  | 1     |
| API        | Vercel Serverless Functions, TypeScript | 2     |
| ORM        | Prisma                                  | 2     |
| DB         | Supabase PostgreSQL                     | 2     |
| 認証       | GitHub OAuth                            | 2     |
| 共有型     | npm workspaces でローカル参照           | 1     |

---

## 3. データモデル

### ローカルデータ（Extension が直接読み書き）

**question-history.json**

```json
{
  "history": [
    {
      "timestamp": "2026-02-28T14:30:00Z",
      "taskId": "理解度チェック-Q1",
      "topic": "typescript",
      "concept": "interface vs type の使い分け",
      "question": "interfaceとtypeの違いは？",
      "userAnswer": "interfaceはextendsできる",
      "isCorrect": false
    }
  ]
}
```

**progress.json**

```json
{
  "current_task": 1,
  "completed_tasks": [],
  "resume_context": "",
  "unresolved_gaps": []
}
```

**`.mentor-studio.json`（プロジェクト設定、ワークスペースルートに配置）**

```json
{
  "repositoryName": "my-project",
  "topics": [
    { "key": "typescript", "label": "TypeScript" },
    { "key": "react", "label": "React" },
    { "key": "backend", "label": "Backend / Express" },
    { "key": "database", "label": "Database / Prisma" },
    { "key": "auth", "label": "Authentication" },
    { "key": "validation", "label": "Validation / Zod" },
    { "key": "api_client", "label": "API Client / Fetch" },
    { "key": "css", "label": "CSS / Styling" },
    { "key": "testing", "label": "Testing" },
    { "key": "deployment", "label": "Deployment" },
    { "key": "git", "label": "Git" }
  ]
}
```

- `key`: データ記録・集計に使う内部識別子（スネークケース）。AIはこの値を `topic` フィールドに記録する
- `label`: ダッシュボードUI上の表示名。ユーザーが自由に変更可能

### Prisma Schema（Phase 2）

```prisma
model User {
  id        String   @id @default(cuid())
  githubId  String   @unique
  name      String?
  avatarUrl String?
  createdAt DateTime @default(now())
  projects  Project[]
}

model Project {
  id             String   @id @default(cuid())
  userId         String
  repositoryName String
  topics         String   @default("[]")
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs           QuestionLog[]

  @@unique([userId, repositoryName])
}

model QuestionLog {
  id         String   @id @default(cuid())
  projectId  String
  question   String
  userAnswer String
  isCorrect  Boolean
  taskId     String
  topic      String
  concept    String
  timestamp  DateTime @default(now())
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, topic])
  @@index([projectId, timestamp])
}
```

### ローカル → DB フィールド対応表

ローカルとDBで同一フィールド名を使用。

| フィールド   | 説明                              |
| ------------ | --------------------------------- |
| `timestamp`  | ISO 8601 形式                     |
| `taskId`     | タスク識別子                      |
| `topic`      | topicリストから選択               |
| `concept`    | 概念名                            |
| `question`   | 出題内容                          |
| `userAnswer` | 学習者の回答                      |
| `isCorrect`  | 正誤                              |
| `projectId`  | DB側のみ。repositoryName から解決 |

---

## 4. File Watcher & 同期ロジック

### Phase 1: ローカル表示の更新

Extension が以下のファイルの変更を `vscode.workspace.createFileSystemWatcher` で監視：

```
**/docs/mentor/question-history.json
**/docs/mentor/progress.json
```

ファイル変更検知 → JSONを再読み込み → サイドバーWebviewに `postMessage` で最新データを送信。

**Claude Code と Extension は別プロセス。** Claude Codeがファイルを書き込んでも Extension の処理を待たない。File watcher は非同期イベントリスナーで、ファイル書き込みをブロックしない。

### Phase 2: API送信の追加

Phase 1のローカル更新に加え、APIへの送信を追加：

```
ファイル変更検知
    │
    ▼
Debounce 5秒（連続変更をまとめる）
    │
    ▼
前回送信済みの状態と比較
    │
    ▼
新規エントリのみ抽出（配列長の比較、末尾の差分のみ取得）
    │
    ▼
APIに送信（POST /api/logs、バッチ送信）
    │
    ├─ 成功 → globalState の「最終送信位置」を更新
    │
    └─ 失敗 → ローカルキューに保持、次回リトライ
```

**Debounce の仕組み:**

```
Claude Codeが書き込み → 5秒タイマー開始
  また書き込み → タイマーリセット
  また書き込み → タイマーリセット
  5秒間変更なし → ここで1回だけ送信
```

**オフライン対応:**

- 送信失敗時はキューに溜めて、次のファイル変更時 or Extension起動時にリトライ
- キューも globalState に永続化

---

## 5. API エンドポイント設計（Phase 2）

### 認証

GitHub OAuth でログイン。全エンドポイントでセッショントークンを検証。

### エンドポイント一覧

```
POST   /api/logs          ← ログ送信（バッチ対応）
GET    /api/logs          ← ログ一覧取得（ダッシュボード用）
POST   /api/projects      ← プロジェクト登録 / topic同期
GET    /api/projects      ← プロジェクト一覧
GET    /api/stats         ← 集計データ（正答率、topic別など）
GET    /api/auth/github   ← GitHub OAuthフロー開始
GET    /api/auth/callback ← OAuthコールバック
```

### 主要エンドポイント詳細

**POST /api/logs** — ログ送信

```json
// Request
{
  "repositoryName": "my-project",
  "logs": [
    {
      "question": "interface と type の違いは？",
      "userAnswer": "interface は extends できる",
      "isCorrect": false,
      "taskId": "理解度チェック-Q1",
      "topic": "typescript",
      "concept": "interface vs type の使い分け",
      "timestamp": "2026-02-28T14:30:00Z"
    }
  ]
}

// Response 200
{ "data": { "received": 1 }, "message": "Logs saved" }
```

- 配列で受け取り（debounce中に溜まった複数件を一括送信）
- `repositoryName` でプロジェクト解決。未登録なら自動作成

**GET /api/stats** — 集計データ

```json
// GET /api/stats?repositoryName=my-project
// Response 200
{
  "data": {
    "totalQuestions": 19,
    "correctRate": 0.63,
    "byTopic": [
      { "topic": "typescript", "total": 4, "correct": 2, "rate": 0.5 },
      { "topic": "auth", "total": 4, "correct": 3, "rate": 0.75 }
    ],
    "unresolvedGaps": [
      {
        "topic": "typescript",
        "concept": "Partial<T> の定義",
        "firstMissed": "2026-02-28"
      }
    ],
    "recentActivity": [
      { "date": "2026-03-15", "total": 1, "correct": 0 },
      { "date": "2026-03-14", "total": 4, "correct": 2 }
    ]
  }
}
```

**POST /api/projects** — プロジェクト登録

```json
// Request
{
  "repositoryName": "my-project",
  "topics": ["typescript", "react", "backend"]
}
```

- 既存なら topics を更新、なければ新規作成（upsert）

---

## 6. サイドバーダッシュボード UI

### 技術方針

- **React + TypeScript** でWebview UIを構築
- **esbuild** でバンドル
- Extension Host ↔ Webview 間は `postMessage` で通信
- Phase 1ではチャートなし。プログレスバー等はCSS描画

### 画面構成

サイドバーWebview内でタブ切り替え：

```
┌──────────────────────────┐
│ Mentor Studio            │
│ ┌──────────────────────┐ │
│ │ [Overview] [Topics]  │ │
│ │         [Actions]    │ │
│ ├──────────────────────┤ │
│ │                      │ │
│ │   (各タブの内容)      │ │
│ │                      │ │
│ └──────────────────────┘ │
│                          │
│ ✓ Local data loaded      │
└──────────────────────────┘
```

### Overview タブ

```
┌──────────────────────────┐
│ my-project               │
│                          │
│ 📊 Overall               │
│ ┌──────────────────────┐ │
│ │ 正答率  63%           │ │
│ │ ████████░░░░  12/19   │ │
│ └──────────────────────┘ │
│                          │
│ ⚠ Unresolved Gaps (6)    │
│ ┌──────────────────────┐ │
│ │ typescript             │ │
│ │  • Partial<T> の定義   │ │
│ │  • interface vs type   │ │
│ │ react                  │ │
│ │  • useState lazy init  │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### Topics タブ

```
┌──────────────────────────┐
│ Topic別 正答率            │
│                          │
│ auth         ████░ 75%   │
│ typescript   ██░░░ 50%   │
│ database     ██░░░ 40%   │
│ tanstack     ░░░░░  0%   │
│                          │
│ ▼ typescript (2/4)       │
│ ┌──────────────────────┐ │
│ │ ✅ ジェネリクスの役割  │ │
│ │ ❌ interface vs type  │ │
│ │ ❌ Partial<T> の定義   │ │
│ │ ✅ z.inferの活用      │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### Actions タブ

コピー可能なプロンプトスニペット。ユーザーがコピーしてClaude Codeのチャットにペーストして実行する。

```
┌──────────────────────────┐
│ 🎓 Mentor Actions        │
│                          │
│ ┌──────────────────┐     │
│ │ Start a quiz     │ 📋  │
│ └──────────────────┘     │
│ ┌──────────────────┐     │
│ │ Review weak spots│ 📋  │
│ └──────────────────┘     │
│ ┌──────────────────┐     │
│ │ Start next task  │ 📋  │
│ └──────────────────┘     │
└──────────────────────────┘
```

プロンプト例:

```
docs/mentor/MENTOR_RULES.md を読んで、現在のタスクに関する理解度クイズを出してください。
結果は question-history.json に記録してください。
```

### ステータス表示

| 状態                       | 表示                             | Phase |
| -------------------------- | -------------------------------- | ----- |
| ローカルデータ読み込み済み | `✓ Local data loaded`            | 1     |
| プロジェクト未設定         | `○ No .mentor-studio.json found` | 1     |
| 接続済み・同期済み         | `● Connected  ✓ Synced`          | 2     |
| 送信中                     | `● Connected  ↻ Syncing...`      | 2     |
| 未送信キューあり           | `● Connected  ⚠ 3 pending`       | 2     |
| 接続エラー                 | `✕ Error: 詳細`                  | 2     |

---

## 7. Extension 設定 & セキュリティ

### Extension Settings（package.json contributes.configuration）

**Phase 1:**

```json
{
  "mentor-studio.mentorFilesPath": {
    "type": "string",
    "default": "docs/mentor",
    "description": "Path to mentor data files relative to workspace root"
  }
}
```

**Phase 2 で追加:**

```json
{
  "mentor-studio.apiUrl": {
    "type": "string",
    "default": "https://mentor-studio-api.vercel.app",
    "description": "API server URL"
  }
}
```

### 監視ファイルパスの検出

Extension起動時：

1. ワークスペースのルートで `.mentor-studio.json` を探す
2. 見つかれば file watcher を起動し、サイドバーにデータ表示
3. 見つからなければ → サイドバーに「Setup Mentor」ボタンを表示

### セットアップフロー

「Setup Mentor」ボタン押下時：

1. `docs/mentor/` ディレクトリを作成
2. `progress.json`（初期状態）を生成
3. `question-history.json`（空の history 配列）を生成
4. `MENTOR_RULES.md` を生成
5. `.mentor-studio.json`（デフォルトtopicリスト付き）をワークスペースルートに生成
6. ユーザーに確認の上、`CLAUDE.md` に `@docs/mentor/MENTOR_RULES.md` を追記（既存ファイルがあれば末尾に追記、なければ新規作成）

### セキュリティ方針（Phase 2）

| 項目         | 方針                                            |
| ------------ | ----------------------------------------------- |
| 認証         | GitHub OAuth（ブラウザ経由）                    |
| トークン保存 | VSCode SecretStorage（暗号化）                  |
| API通信      | HTTPS のみ                                      |
| レート制限   | Vercelのデフォルト + 将来的にユーザー単位で追加 |

---

## 8. フェーズ計画

### Phase 1 — POC（Extension のみ、ローカル完結）

| 機能                     | 詳細                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| メンターファイル生成     | 「Setup Mentor」ボタンで `docs/mentor/` 以下を生成                                          |
| CLAUDE.md 追記           | `@docs/mentor/MENTOR_RULES.md` の1行を追記（ユーザー確認あり）                              |
| ローカルデータ読み込み   | `question-history.json` / `progress.json` を直接読んで表示                                  |
| サイドバーダッシュボード | Overview（正答率、unresolved gaps）/ Topics（topic別一覧）/ Actions（プロンプトスニペット） |
| File watcher             | JSONファイル変更検知 → サイドバー表示を自動更新                                             |

### Phase 2 — API + DB + 認証

| 機能                    | 詳細                                          |
| ----------------------- | --------------------------------------------- |
| GitHub OAuthログイン    | Extension からブラウザ経由でログイン          |
| Vercel API              | Serverless Functions でログ受信・集計         |
| Supabase PostgreSQL     | ログの永続化                                  |
| File watcher → API送信  | ローカル表示に加え、debounce 5秒でAPIにも送信 |
| プロジェクト管理        | 複数リポジトリのログを紐づけ                  |
| Webダッシュボードの土台 | APIが整うことで将来のWeb UIが繋がれる状態に   |

### Phase 3 — 可視化強化 + Web

| 機能              | 詳細                                           |
| ----------------- | ---------------------------------------------- |
| チャート          | Topic別正答率バー、学習量の推移グラフ          |
| Webダッシュボード | React アプリ。複数プロジェクトの進捗を横断表示 |
| 高度な分析        | 時期別の成長率、苦手分野の傾向など             |

---

## 9. 設計判断の記録

| 判断               | 選択                                                                      | 理由                                                                    |
| ------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| メンター機能の担当 | Claude Code（Extension外）                                                | ユーザーは既にClaude Code Proに課金。Extension はログ収集と可視化に専念 |
| ログ送信方式       | File watcher（Phase 1: ローカル更新、Phase 2: debounce 5秒でAPI送信追加） | 自動で変更検知。Claude Codeの処理を妨げない（別プロセス）               |
| Topic管理          | 設定ファイルに定義済みリスト → AIが選択                                   | 表記揺れ防止。ユーザーがカスタマイズ可能                                |
| Webview UI         | React + TypeScript, esbuild                                               | 開発体験とレビュアビリティ。将来Preactへの移行も容易                    |
| フォルダ構成       | モノレポ                                                                  | 型の共有が簡単。将来のWebダッシュボード追加もフォルダ追加のみ           |
| API                | Vercel Serverless Functions                                               | 無料。将来のWebダッシュボードと同一プロジェクト内でデプロイ             |
| DB                 | Supabase PostgreSQL                                                       | 無料枠に期限なし。Prisma で接続                                         |
| 認証               | Phase 1: なし → Phase 2: GitHub OAuth                                     | POCではローカル完結。公開時にスムーズなOAuth体験を提供                  |
| CLAUDE.md の扱い   | `@docs/mentor/MENTOR_RULES.md` の1行追記                                  | 既存CLAUDE.mdへの影響最小限。メンター指示は別ファイルに集約             |
| Claude Code連携    | コピー可能なプロンプトスニペット                                          | Claude Code Extension は外部コマンド受信APIを公開していないため         |
| ダッシュボード配置 | サイドバーWebviewのみ                                                     | 軽量。詳細分析は将来のWebダッシュボードへ誘導                           |
