![version](https://img.shields.io/badge/version-0.0.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)

# Mentor Studio Code

A learning dashboard for AI mentor sessions using Claude Code. It provides an Overview, Actions, and Settings panel in the VS Code sidebar to help you track and continue your learning.

Claude Code を使ったAIメンターセッションの学習ダッシュボードです。VS Code のサイドバーに進捗・操作・設定パネルを提供し、学習の記録と継続をサポートします。

## Screenshot / スクリーンショット

The dashboard displays your mentor session progress.
ダッシュボードにはメンターセッションの進捗が表示されます。

<!-- To add a screenshot:
     1. Create the docs/images/ folder if it doesn't exist
     2. Save your image file to docs/images/
     3. Edit the line below to use the actual filename -->

![Dashboard](docs/images/screenshot.png)

## Prerequisites / 前提条件

**Required to install the extension / インストールに必要なもの:**

- [VS Code](https://code.visualstudio.com/) 1.85.0 or later / 以上
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) installed / がインストールされていること

> **Note:** To use the AI mentor features, you must have a Claude API key configured in Claude Code.
>
> **注:** AIメンター機能を使うには、Claude Code に Claude API キーが設定されている必要があります。

## Installation / インストール

### From the VS Code Marketplace (recommended) / VS Code Marketplace から（推奨）

1. Open VS Code / VS Code を開く
2. Open the Extensions tab (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Search for `Mentor Studio Code` and install / `Mentor Studio Code` を検索してインストール

### From a VSIX file / VSIX ファイルから

1. Download the `.vsix` file from [Releases](https://github.com/nabetxan/mentor-studio-code/releases)
2. In the Extensions tab, click `…` in the top-right → `Install from VSIX…`
   拡張機能タブ右上の「…」→「VSIXからインストール」を選択

## Setup / セットアップ

1. Open the project you want to study in VS Code / 学習したいプロジェクトを VS Code で開く
2. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Mentor Studio: Setup Mentor` / `Mentor Studio: Setup Mentor` を実行する
4. A `.mentor-studio.json` file is generated in the project root / プロジェクトルートに `.mentor-studio.json` が生成される
5. When the "Reload Window" dialog appears, click it / 「Reload Window」ダイアログが表示されたら押す
6. After reload, the Mentor Studio icon appears in the Activity Bar / リロード後、アクティビティバーに Mentor Studio アイコンが表示される

> **Tip:** If you open the dashboard before running Setup, you will see a prompt to run it.
>
> **ヒント:** Setup を実行する前にダッシュボードを開くと、セットアップを促すメッセージが表示されます。

## Usage / 使い方

Click the Mentor Studio icon in the Activity Bar to open the dashboard. The dashboard is a single sidebar with three tabs.

アクティビティバーの Mentor Studio アイコンをクリックするとダッシュボードが開きます。ダッシュボードは1つのサイドバーに3つのタブで構成されています。

The **Mentor** ON/OFF toggle in the navigation bar lets you enable or disable the mentor feature. The setting is read at the start of each session, so changes take effect from the next session.

ナビゲーションバーの右端にある **メンター機能** の ON/OFF トグルで、メンター機能を切り替えられます。設定はセッション開始時に読み込まれるため、切り替え後は新しいセッションから反映されます。

### Overview

Shows your current task, correct answer rate, per-topic progress, and unresolved knowledge gaps.
現在のタスク・正答率・トピック別進捗・未解決の理解ギャップを確認できます。

### Actions

Copy prompts to send to your AI mentor with one click.
AIメンターに渡すプロンプトをワンクリックでコピーできます。

| Button / ボタン       | Purpose / 用途                                                         |
| --------------------- | ---------------------------------------------------------------------- |
| Start Next Task       | Use when starting the next task / 次のタスクを始めるとき               |
| Review Implementation | Use when asking for a code review / 実装コードのレビューを依頼するとき |
| Start Review          | Use when starting a review session / 学習内容の復習を始めるとき        |
| Start Check           | Use when starting a comprehension check / 理解度チェックを始めるとき   |

### Settings / 設定

| Setting / 設定項目  | Description / 内容                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Plan / Spec files   | Link the files your mentor session references / メンターセッションで参照するファイルを紐付ける |
| Language / 言語切替 | Switch between Japanese and English / 日本語・英語を切り替える                                 |

## License / ライセンス

[MIT](LICENSE)
