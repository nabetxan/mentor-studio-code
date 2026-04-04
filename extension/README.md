![version](https://img.shields.io/badge/version-0.1.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

# Mentor Studio Code

Learn to code with an AI mentor powered by Claude Code. Track your understanding, spot your weak points, and keep learning in your own projects — all inside VS Code.

## Screenshot

The dashboard displays your mentor session progress.

<img src="https://raw.githubusercontent.com/nabetxan/mentor-studio-code/main/extension/images/overview_mentor-studio-code.png" alt="Dashboard" width="350">

## Prerequisites

- [VS Code](https://code.visualstudio.com/) 1.85.0 or later
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) installed

> **Note:** This extension uses Claude Code (Anthropic's official CLI tool) to power the AI mentor. Claude Code installation and a subscription (Claude Pro / Max) are required.

## Installation

### From a VSIX file

1. Download the `.vsix` file from [Releases](https://github.com/nabetxan/mentor-studio-code/releases)
2. In the Extensions tab, click `…` in the top-right → `Install from VSIX…`

## Setup

1. Open the project you want to build with AI Mentor in VS Code
2. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Mentor Studio Code: Setup Mentor`
4. The `.mentor/` directory is created with config, rules, skills, and data files
5. Choose where to add the mentor reference — project-wide `CLAUDE.md` or your personal settings
6. When the "Reload Window" dialog appears, click it
7. After reload, the Mentor Studio Code icon appears in the Activity Bar

> **Tip:** If you open the dashboard before running Setup, you will see a prompt to run it.

## Usage

Click the Mentor Studio Code icon in the Activity Bar to open the dashboard. The dashboard is a single sidebar with three tabs.

The **Mentor** ON/OFF toggle in the navigation bar lets you enable or disable the mentor feature. The setting is read at the start of each session, so changes take effect from the next session.

### Overview

Shows your current task, correct answer rate, per-topic progress, and unresolved knowledge gaps. You can also manage topics here — add new topics, edit labels, and merge duplicates.

### Actions

Copy prompts to send to your AI mentor with one click.

| Button                | Purpose                                 |
| --------------------- | --------------------------------------- |
| Start Next Task       | Use when starting the next task         |
| Review Implementation | Use when asking for a code review       |
| Start Review          | Use when starting a review session      |
| Start Check           | Use when starting a comprehension check |

### Settings

| Setting           | Description                                       |
| ----------------- | ------------------------------------------------- |
| Profile           | Register or update your learner profile           |
| Plan / Spec files | Link the files your mentor session references     |
| Language          | Switch between Japanese and English               |

## License

[MIT](LICENSE)

---

# Mentor Studio Code（日本語）

AIメンターと一緒にコーディングを学ぶためのVSCode拡張。自分のプロジェクトの中で、理解度の確認・弱点の可視化・復習ができます。

## 前提条件

- [VS Code](https://code.visualstudio.com/) 1.85.0 以上
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) がインストールされていること

> **注:** この拡張機能はAIメンターの動作に Claude Code（Anthropic公式CLIツール）を使用します。事前に Claude Code のインストールとサブスクリプション（Claude Pro / Max）が必要です。

## インストール

### VSIX ファイルから

1. [Releases](https://github.com/nabetxan/mentor-studio-code/releases) から `.vsix` ファイルをダウンロード
2. 拡張機能タブ右上の「…」→「VSIXからインストール」を選択

## セットアップ

1. AIメンターと一緒に開発したいプロジェクトを VS Code で開く
2. コマンドパレットを開く（`Cmd+Shift+P` / `Ctrl+Shift+P`）
3. `Mentor Studio Code: Setup Mentor` を実行する
4. `.mentor/` ディレクトリに設定・ルール・スキル・データファイルが生成される
5. メンター参照の追加先を選択 — プロジェクト共通の `CLAUDE.md` または個人設定
6. 「Reload Window」ダイアログが表示されたら押す
7. リロード後、アクティビティバーに Mentor Studio Code アイコンが表示される

> **ヒント:** Setup を実行する前にダッシュボードを開くと、セットアップを促すメッセージが表示されます。

## 使い方

アクティビティバーの Mentor Studio Code アイコンをクリックするとダッシュボードが開きます。ダッシュボードは1つのサイドバーに3つのタブで構成されています。

ナビゲーションバーの右端にある **メンター機能** の ON/OFF トグルで、メンター機能を切り替えられます。設定はセッション開始時に読み込まれるため、切り替え後は新しいセッションから反映されます。

### Overview

現在のタスク・正答率・トピック別進捗・未解決の理解ギャップを確認できます。トピックの追加・ラベル編集・マージもここから行えます。

### Actions

AIメンターに渡すプロンプトをワンクリックでコピーできます。

| ボタン                | 用途                               |
| --------------------- | ---------------------------------- |
| Start Next Task       | 次のタスクを始めるとき             |
| Review Implementation | 実装コードのレビューを依頼するとき |
| Start Review          | 学習内容の復習を始めるとき         |
| Start Check           | 理解度チェックを始めるとき         |

### Settings

| 設定項目          | 内容                                           |
| ----------------- | ---------------------------------------------- |
| Profile           | 学習者プロフィールの登録・更新                 |
| Plan / Spec files | メンターセッションで参照するファイルを紐付ける |
| Language          | 日本語・英語を切り替える                       |

## ライセンス

[MIT](LICENSE)
