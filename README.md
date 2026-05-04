![version](https://img.shields.io/badge/version-0.6.9-blue)
![license](https://img.shields.io/badge/license-MIT-green)
[![website](https://img.shields.io/badge/%F0%9F%8C%90_Website-Landing_Page-7ec8e3)](https://nabetxan.github.io/mentor-studio-code/)

# Mentor Studio Code

🌐 [Website](https://nabetxan.github.io/mentor-studio-code/)

Learn to code with an AI mentor workflow wired into `CLAUDE.md` and `AGENTS.md` entrypoints. Track your understanding, spot your weak points, and keep learning in your own projects — all inside VS Code.

> **How It Works:** Mentor Studio Code does not include or run an AI model by itself. Instead, it writes Mentor instructions into the entrypoint files used by your AI tool: `CLAUDE.md` for Claude Code, or `AGENTS.md` for tools that read `AGENTS.md`.
>
> **Note:** If you plan to use Claude Code, see [Anthropic's official documentation](https://docs.anthropic.com/en/docs/claude-code/overview) for setup, requirements, and current availability. "Claude" and "Claude Code" are trademarks of Anthropic.

<img src="https://raw.githubusercontent.com/nabetxan/mentor-studio-code/main/extension/images/overview_mentor-studio-code.png" alt="Dashboard" width="350">

## Quick Start

1. Install [VS Code](https://code.visualstudio.com/) 1.85.0+
2. If you want Claude Code support, install the [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
3. Install [Mentor Studio Code](https://marketplace.visualstudio.com/items?itemName=nabetxan.mentor-studio-code) from the Marketplace
4. Click the Mentor Studio Code icon in the Activity Bar and press the **Setup** button
   - You can also click **Run Setup** in the notification, or open Command Palette (`Cmd+Shift+P`) → `Mentor Studio Code: Setup Mentor`
5. In Setup, choose which entrypoint files should use Mentor (`CLAUDE.md` and/or `AGENTS.md`)
6. If you enable `CLAUDE.md`, choose whether Mentor should be added to the project `CLAUDE.md` or your personal Claude settings
7. If you enable `AGENTS.md`, Setup writes a managed Mentor block to the project `AGENTS.md`
8. The dashboard updates immediately, and Mentor is ready to use

You can change the entrypoint wiring later in **Settings** → **Entrypoint Files Using Mentor**. Re-running Setup refreshes Mentor templates and keeps existing entrypoint wiring; Settings asks for confirmation before it edits `CLAUDE.md` or `AGENTS.md`.

For detailed usage, see [extension/README.md](extension/README.md). For the full product spec, see [docs/app-specification.md](docs/app-specification.md).

## Data Location

Mentor stores its learning history DB in your OS user-data directory (outside the workspace) so it doesn't conflict with `git pull` / `checkout` / `rebase`. `<workspaceId>` is `<sanitized-repositoryName>-<UUID>` (e.g. `mentor-studio-code-550e8400-e29b-41d4-a716-446655440000`) so the directory is identifiable in your file manager:

- macOS: `~/Library/Application Support/MentorStudioCode/<workspaceId>/data.db`
- Linux: `~/.local/share/mentor-studio-code/<workspaceId>/data.db`
- Windows: `%APPDATA%\MentorStudioCode\<workspaceId>\data.db`

The exact path is shown in the sidebar's **Data Location** section. Use the "Open folder" button there to reveal the directory in your OS file manager — copy `data.db` to back up, or overwrite it (with VSCode closed) to restore.

## Upgrading from earlier versions

If you used Mentor Studio Code v0.6.5 or earlier, **run Setup once after upgrading to v0.6.6 or later**. The extension detects the legacy `.mentor/data.db` and surfaces a prompt in the sidebar (and a toast) inviting you to run Setup. Setup performs the v3 migration — it copies your DB to the OS user-data directory, leaves a `.mentor/data.db.migrated-YYYY-MM-DD` backup in the workspace, and then re-enables the dashboard. New installations skip this step and proceed straight through Setup as usual.

If you previously committed `.mentor/data.db` to git, Setup also offers a one-click untrack and stages `.mentor/.gitignore` so a single `git commit` finalizes the cleanup.

**Backup / restore:** copy `data.db` directly from the path shown in the sidebar's Data Location section. To restore, overwrite the same path with your saved copy and restart VSCode. Built-in Export/Import commands are planned for a future release.

## Links

- [Release Notes](https://github.com/nabetxan/mentor-studio-code/releases)
- [Issues / Feedback](https://github.com/nabetxan/mentor-studio-code/issues)

## License

[MIT](extension/LICENSE)

---

# Mentor Studio Code（日本語）

🌐 [Website](https://nabetxan.github.io/mentor-studio-code/)

`CLAUDE.md` と `AGENTS.md` のエントリポイントに接続して使う、AI メンターワークフロー向けの VS Code 拡張。自分のプロジェクトの中で、理解度の確認・正答率の可視化・弱点トピックの追跡ができます。

> **仕組み:** Mentor Studio Code 自体には AI モデルやチャット機能は含まれていません。代わりに、利用する AI ツールのエントリポイントに Mentor 用の指示を書き込みます。`CLAUDE.md` は Claude Code 向け、`AGENTS.md` は `AGENTS.md` を読むツール向けです。
>
> **注:** Claude Code を使う場合は、セットアップ・動作要件・最新の提供状況について [Anthropic公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/overview) をご確認ください。「Claude」「Claude Code」は Anthropic の商標です。

## Quick Start

1. [VS Code](https://code.visualstudio.com/) 1.85.0+ をインストール
2. Claude Code を使う場合は [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) をインストール
3. マーケットプレイスから [Mentor Studio Code](https://marketplace.visualstudio.com/items?itemName=nabetxan.mentor-studio-code) をインストール
4. アクティビティバーの Mentor Studio Code アイコンをクリックし、**Setup** ボタンを押す
   - 通知の **Setup を実行** を押すか、コマンドパレット（`Cmd+Shift+P`）→ `Mentor Studio Code: Setup Mentor` からも実行できます
5. Setup で Mentor を使うエントリポイントファイル（`CLAUDE.md` / `AGENTS.md`）を選択
6. `CLAUDE.md` を有効にした場合は、`CLAUDE.md` の追加先をプロジェクト共通か個人設定か選択
7. `AGENTS.md` を有効にした場合は、プロジェクトの `AGENTS.md` に管理対象の Mentor ブロックを追加
8. ダッシュボードがすぐに更新され、そのまま Mentor を使い始められる

あとから **Settings** → **Entrypoint Files Using Mentor** で変更できます。Setup を再実行すると Mentor テンプレートを更新し、既存のエントリポイント設定は維持されます。Settings から `CLAUDE.md` / `AGENTS.md` を変更する場合は、実際にファイルを書き換える前に確認ダイアログが表示されます。

詳しい使い方は [extension/README.md](extension/README.md) をご覧ください。

## データの場所

Mentor は学習履歴 DB を OS のユーザーデータディレクトリ(ワークスペース外)に保存します。これにより `git pull` / `checkout` / `rebase` と衝突しません。`<workspaceId>` は `<sanitized-repositoryName>-<UUID>` 形式(例: `mentor-studio-code-550e8400-e29b-41d4-a716-446655440000`)で、ファイルマネージャ上でどのワークスペースのデータか識別できます。

- macOS: `~/Library/Application Support/MentorStudioCode/<workspaceId>/data.db`
- Linux: `~/.local/share/mentor-studio-code/<workspaceId>/data.db`
- Windows: `%APPDATA%\MentorStudioCode\<workspaceId>\data.db`

正確なパスはサイドバーの **データの場所** セクションで確認できます。同セクションの「フォルダを開く」ボタンで OS のファイルマネージャを開き、`data.db` をコピーすればバックアップ、上書きすれば(VSCode を閉じた状態で)リストアになります。

過去に `.mentor/data.db` を git に commit していた場合、Setup 完了後にワンクリックで untrack できる通知が表示されます。`.mentor/.gitignore` も自動でステージされるため、その後の `git commit` 1 回でクリーンアップが完了します。

**バックアップ・リストア:** サイドバーに表示されているパスから `data.db` を直接コピーして保管。リストアは保管した `.db` ファイルを同じパスへ上書きして VSCode を再起動してください。Export/Import コマンドは将来のリリースで追加予定です。

## Links

- [Release Notes](https://github.com/nabetxan/mentor-studio-code/releases)
- [Issues / Feedback](https://github.com/nabetxan/mentor-studio-code/issues)

## ライセンス

[MIT](extension/LICENSE)
