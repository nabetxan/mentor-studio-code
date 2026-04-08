![version](https://img.shields.io/badge/version-0.3.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)
[![website](https://img.shields.io/badge/%F0%9F%8C%90_Website-Landing_Page-7ec8e3)](https://nabetxan.github.io/mentor-studio-code/)

# Mentor Studio Code

An AI-mentor extension for VS Code, optimized for use with Claude Code. Track your understanding, spot your weak points, and keep learning in your own projects.

> **Note:** This extension is designed to work with [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview). Please refer to [Anthropic's official documentation](https://docs.anthropic.com/en/docs/claude-code/overview) for Claude Code's installation, requirements, and available plans.
>
> **Disclaimer:** This extension is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Anthropic, PBC. "Claude" and "Claude Code" are trademarks of Anthropic.

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

## Uninstall

This extension creates files and references outside the extension itself (`.mentor/` folder, `CLAUDE.md` references, learner profile in VS Code storage). Simply uninstalling from the Extensions tab will leave these behind. Follow the steps below to clean up before uninstalling.

### Steps

1. Open the **Settings** tab in the Mentor Studio Code sidebar
2. Scroll down to the **Uninstall Guide** section and expand it
3. Select what to delete:
   - **Learner Profile** — your profile stored in VS Code (checked by default)
   - **CLAUDE.md Reference** — the `@.mentor/rules/MENTOR_RULES.md` line added to your CLAUDE.md (checked by default)
   - **.mentor Folder** — all config, rules, skills, and learning history (unchecked by default — check this if you want a full removal)
4. Click the **Delete Data** button and confirm
5. Now uninstall the extension from VS Code as usual

<img src="https://raw.githubusercontent.com/nabetxan/mentor-studio-code/main/extension/images/uninstall_settings_en.png" alt="Uninstall Guide in Settings" width="350">

> **Tip:** If you already uninstalled without cleaning up, reinstall the extension, run the cleanup above, then uninstall again.

## License

[MIT](LICENSE)

---

# Mentor Studio Code（日本語）

Claude Codeと組み合わせて使う、AIメンター付きのVSCode拡張。自分のプロジェクトの中で、理解度の確認・弱点の可視化・復習ができます。

> **注:** この拡張機能は [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) と合わせて使用することを前提としています。Claude Code のインストール・動作要件・利用可能なプランについては [Anthropic公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/overview) をご確認ください。
>
> **免責事項:** この拡張機能は独立したオープンソースプロジェクトであり、Anthropic, PBC との提携・推薦・後援関係はありません。「Claude」「Claude Code」は Anthropic の商標です。

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

## アンインストール

この拡張機能は、拡張機能本体の外にもファイルや参照を作成します（`.mentor/` フォルダ、`CLAUDE.md` への参照、VS Code ストレージ内の学習者プロフィール）。拡張機能タブから通常のアンインストールを行うだけでは、これらが残ったままになります。以下の手順でクリーンアップしてからアンインストールしてください。

### 手順

1. サイドバーの Mentor Studio Code から **Settings** タブを開く
2. 下部の **Uninstall Guide** セクションを展開する
3. 削除対象を選択する：
   - **Learner Profile** — VS Code に保存された学習者プロフィール（デフォルトでチェック済み）
   - **CLAUDE.md Reference** — CLAUDE.md に追加された `@.mentor/rules/MENTOR_RULES.md` の行（デフォルトでチェック済み）
   - **.mentor Folder** — 設定・ルール・スキル・学習履歴のすべて（デフォルトではチェックなし — 完全削除したい場合はチェック）
4. **データ消去** ボタンをクリックして確認する
5. 通常どおり VS Code から拡張機能をアンインストールする

<img src="https://raw.githubusercontent.com/nabetxan/mentor-studio-code/main/extension/images/uninstall_settings_ja.png" alt="Settings 内の Uninstall Guide" width="350">

> **ヒント:** クリーンアップせずにアンインストールしてしまった場合は、再インストールしてから上記の手順を実行し、その後もう一度アンインストールしてください。

## ライセンス

[MIT](LICENSE)
