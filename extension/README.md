![version](https://img.shields.io/badge/version-0.1.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

# Mentor Studio Code

Track your learning progress and review history with AI mentor sessions powered by Claude Code. It provides an Overview, Actions, and Settings panel in the VS Code sidebar to help you track and continue your learning.

## Screenshot

The dashboard displays your mentor session progress.

<img src="https://raw.githubusercontent.com/nabetxan/mentor-studio-code/main/extension/images/overview_mentor-studio-code.png" alt="Dashboard" width="350">

## Prerequisites

- [VS Code](https://code.visualstudio.com/) 1.85.0 or later
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) installed

> **Note:** To use the AI mentor features, you must have a Claude API key configured in Claude Code.

## Installation

### From a VSIX file

1. Download the `.vsix` file from [Releases](https://github.com/nabetxan/mentor-studio-code/releases)
2. In the Extensions tab, click `…` in the top-right → `Install from VSIX…`

## Setup

1. Open the project you want to build with AI Mentor in VS Code
2. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Mentor Studio: Setup Mentor`
4. A `.mentor-studio.json` file is generated in the project root
5. When the "Reload Window" dialog appears, click it
6. After reload, the Mentor Studio icon appears in the Activity Bar

> **Tip:** If you open the dashboard before running Setup, you will see a prompt to run it.

## Usage

Click the Mentor Studio icon in the Activity Bar to open the dashboard. The dashboard is a single sidebar with three tabs.

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

| Setting           | Description                                   |
| ----------------- | --------------------------------------------- |
| Plan / Spec files | Link the files your mentor session references |
| Language          | Switch between Japanese and English           |

## License

[MIT](LICENSE)

---

# Mentor Studio Code（日本語）

Claude Code を活用したAIメンターセッションで、学習の進捗と復習履歴をトラッキングできます。VS Code のサイドバーに進捗・操作・設定パネルを提供し、学習の記録と継続をサポートします。

## 前提条件

- [VS Code](https://code.visualstudio.com/) 1.85.0 以上
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) がインストールされていること

> **注:** AIメンター機能を使うには、Claude Code に Claude API キーが設定されている必要があります。

## インストール

### VSIX ファイルから

1. [Releases](https://github.com/nabetxan/mentor-studio-code/releases) から `.vsix` ファイルをダウンロード
2. 拡張機能タブ右上の「…」→「VSIXからインストール」を選択

## セットアップ

1. AIメンターと一緒に開発したいプロジェクトを VS Code で開く
2. コマンドパレットを開く（`Cmd+Shift+P` / `Ctrl+Shift+P`）
3. `Mentor Studio: Setup Mentor` を実行する
4. プロジェクトルートに `.mentor-studio.json` が生成される
5. 「Reload Window」ダイアログが表示されたら押す
6. リロード後、アクティビティバーに Mentor Studio アイコンが表示される

> **ヒント:** Setup を実行する前にダッシュボードを開くと、セットアップを促すメッセージが表示されます。

## 使い方

アクティビティバーの Mentor Studio アイコンをクリックするとダッシュボードが開きます。ダッシュボードは1つのサイドバーに3つのタブで構成されています。

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
| Plan / Spec files | メンターセッションで参照するファイルを紐付ける |
| Language          | 日本語・英語を切り替える                       |

## ライセンス

[MIT](LICENSE)
