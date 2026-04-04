![version](https://img.shields.io/badge/version-0.2.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

# Mentor Studio Code

Learn to code with an AI mentor powered by Claude Code. Track your understanding, spot your weak points, and keep learning in your own projects — all inside VS Code.

> **Note:** This extension uses [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) (Anthropic's official CLI tool) to power the AI mentor. Claude Code installation and a subscription (Claude Pro / Max) are required.

## Screenshot

The dashboard displays your mentor session progress.

<img src="https://raw.githubusercontent.com/nabetxan/mentor-studio-code/main/extension/images/overview_mentor-studio-code.png" alt="Dashboard" width="350">

## Prerequisites

- [VS Code](https://code.visualstudio.com/) 1.85.0 or later
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) installed

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nabetxan.mentor-studio-code), or search for "Mentor Studio Code" in the Extensions tab.

## Setup

1. Open the project you want to build with AI Mentor in VS Code
2. Click the Mentor Studio Code icon in the Activity Bar and press the **Setup** button
   - If the icon doesn't appear, open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) → `Mentor Studio Code: Setup Mentor`
3. The `.mentor/` directory is created with config, rules, skills, and data files
4. Choose where to add the mentor reference — project-wide `CLAUDE.md` or your personal settings
5. When the "Reload Window" dialog appears, click it
6. After reload, the dashboard opens automatically

## Usage

Click the Mentor Studio Code icon in the Activity Bar to open the dashboard. The dashboard is a single sidebar with three tabs.

The **Mentor** ON/OFF toggle in the navigation bar lets you enable or disable the mentor feature. The setting is read at the start of each session, so changes take effect from the next session.

### Actions

Each button copies a prompt to your clipboard. Paste it into Claude Code to start the corresponding mentor session.

| Button                | When to use                            |
| --------------------- | -------------------------------------- |
| Start Next Task       | Starting the next task                 |
| Review Implementation | Asking for a code review after coding  |
| Start Review          | Reviewing what you've learned so far   |
| Start Check           | Testing your understanding with a quiz |

### Overview

Shows your current task, correct answer rate, per-topic progress, and unresolved knowledge gaps. You can also manage topics here — add new topics, edit labels, and merge duplicates.

### Settings

| Setting           | Description                                   |
| ----------------- | --------------------------------------------- |
| Profile           | Register or update your learner profile       |
| Plan / Spec files | Link the files your mentor session references |
| Language          | Switch between Japanese and English           |

## License

[MIT](LICENSE)

---

# Mentor Studio Code（日本語）

AIメンターと一緒にコーディングを学ぶためのVSCode拡張。自分のプロジェクトの中で、理解度の確認・弱点の可視化・復習ができます。

> **注:** この拡張機能はAIメンターの動作に [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)（Anthropic公式CLIツール）を使用します。事前に Claude Code のインストールとサブスクリプション（Claude Pro / Max）が必要です。

## 前提条件

- [VS Code](https://code.visualstudio.com/) 1.85.0 以上
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) がインストールされていること

## インストール

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nabetxan.mentor-studio-code) からインストールするか、拡張機能タブで「Mentor Studio Code」と検索してください。

## セットアップ

1. AIメンターと一緒に開発したいプロジェクトを VS Code で開く
2. アクティビティバーの Mentor Studio Code アイコンをクリックし、**Setup** ボタンを押す
   - アイコンが見つからない場合は、コマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）→ `Mentor Studio Code: Setup Mentor`
3. `.mentor/` ディレクトリに設定・ルール・スキル・データファイルが生成される
4. メンター参照の追加先を選択 — プロジェクト共通の `CLAUDE.md` または個人設定
5. 「Reload Window」ダイアログが表示されたら押す
6. リロード後、ダッシュボードが自動で開く

## 使い方

アクティビティバーの Mentor Studio Code アイコンをクリックするとダッシュボードが開きます。ダッシュボードは1つのサイドバーに3つのタブで構成されています。

ナビゲーションバーの右端にある **メンター機能** の ON/OFF トグルで、メンター機能を切り替えられます。設定はセッション開始時に読み込まれるため、切り替え後は新しいセッションから反映されます。

### Actions

各ボタンを押すとプロンプトがクリップボードにコピーされます。Claude Code に貼り付けて、対応するメンターセッションを開始します。

| ボタン                | いつ使う？                             |
| --------------------- | -------------------------------------- |
| Start Next Task       | 次のタスクを始めるとき                 |
| Review Implementation | コードを書いた後、レビューを受けるとき |
| Start Review          | これまでの学習内容を復習するとき       |
| Start Check           | クイズ形式で理解度をチェックするとき   |

### Overview

現在のタスク・正答率・トピック別進捗・未解決の理解ギャップを確認できます。トピックの追加・ラベル編集・マージもここから行えます。

### Settings

| 設定項目          | 内容                                           |
| ----------------- | ---------------------------------------------- |
| Profile           | 学習者プロフィールの登録・更新                 |
| Plan / Spec files | メンターセッションで参照するファイルを紐付ける |
| Language          | 日本語・英語を切り替える                       |

## ライセンス

[MIT](LICENSE)
