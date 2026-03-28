![version](https://img.shields.io/badge/version-0.0.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)

[English](README.en.md)

# Mentor Studio Code

Claude Code を使ったAIメンターセッションの学習ダッシュボードです。VS Code のサイドバーに進捗・操作・設定パネルを提供し、学習の記録と継続をサポートします。

## スクリーンショット

ダッシュボードにはメンターセッションの進捗が表示されます。

<!-- スクリーンショットを追加するには:
     1. docs/images/ フォルダを作成してください（なければ）
     2. 画像ファイルを docs/images/ に保存してください
     3. 下の行を編集して実際のファイル名に変えてください -->

![ダッシュボード画面](docs/images/screenshot.png)

## 前提条件

**拡張機能のインストールに必要なもの:**

- [VS Code](https://code.visualstudio.com/) 1.85.0 以上
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) がインストールされていること

> **注:** AIメンター機能を使うには、Claude Code に Claude API キーが設定されている必要があります。

## インストール

### VS Code Marketplace から（推奨）

1. VS Code を開く
2. 拡張機能タブ（`Cmd+Shift+X` / `Ctrl+Shift+X`）を開く
3. `Mentor Studio Code` を検索してインストール

### VSIX ファイルから

1. [Releases](https://github.com/nabetxan/mentor-studio-code/releases) から `.vsix` ファイルをダウンロード
2. VS Code の拡張機能タブ右上の「…」→「VSIXからインストール」を選択

## セットアップ

1. 学習したいプロジェクトを VS Code で開く
2. コマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）を開く
3. `Mentor Studio: Setup Mentor` を実行する
4. プロジェクトルートに `.mentor-studio.json` が生成される
5. 「Reload Window」ダイアログが表示されたら押す
6. リロード後、アクティビティバー（左サイドバー）に Mentor Studio アイコンが表示される

> **ヒント:** Setup を実行する前にダッシュボードを開くと、セットアップを促すメッセージが表示されます。

## 使い方

アクティビティバーの Mentor Studio アイコンをクリックするとダッシュボードが開きます。ダッシュボードは1つのサイドバーに3つのタブで構成されています。

ナビゲーションバーの右端にある **メンター機能** の ON/OFF トグルで、メンター機能を切り替えられます。設定はセッション開始時に読み込まれるため、切り替え後は新しいセッションから反映されます。

### Overview

現在のタスク・正答率・トピック別進捗・未解決の理解ギャップを確認できます。

### Actions

AIメンターに渡すプロンプトをワンクリックでコピーできます。

| ボタン                | 用途                                         |
| --------------------- | -------------------------------------------- |
| Start Next Task       | 次のタスクを始めるときに使う                 |
| Review Implementation | 実装したコードのレビューを依頼するときに使う |
| Start Review          | 学習内容の復習を始めるときに使う             |
| Start Check           | 理解度チェックを始めるときに使う             |

### Settings

| 設定項目             | 内容                                           |
| -------------------- | ---------------------------------------------- |
| Plan / Spec ファイル | メンターセッションで参照するファイルを紐付ける |
| 言語切替             | 日本語・英語を切り替える                       |

## ライセンス

[MIT](LICENSE)
