![version](https://img.shields.io/badge/version-0.6.7-blue)
![license](https://img.shields.io/badge/license-MIT-green)
[![website](https://img.shields.io/badge/%F0%9F%8C%90_Website-Landing_Page-7ec8e3)](https://nabetxan.github.io/mentor-studio-code/)

# Mentor Studio Code

🌐 [Website](https://nabetxan.github.io/mentor-studio-code/)

Learn to code with an AI mentor powered by Claude Code. Track your understanding, spot your weak points, and keep learning in your own projects — all inside VS Code.

> **Note:** This extension is designed to work with [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview). Please refer to [Anthropic's official documentation](https://docs.anthropic.com/en/docs/claude-code/overview) for Claude Code's installation, requirements, and available plans.
>
> **Disclaimer:** This extension is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Anthropic, PBC. "Claude" and "Claude Code" are trademarks of Anthropic.

<img src="https://raw.githubusercontent.com/nabetxan/mentor-studio-code/main/extension/images/overview_mentor-studio-code.png" alt="Dashboard" width="350">

## Quick Start

1. Install [VS Code](https://code.visualstudio.com/) 1.85.0+ and [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
2. Install [Mentor Studio Code](https://marketplace.visualstudio.com/items?itemName=nabetxan.mentor-studio-code) from the Marketplace
3. Click the Mentor Studio Code icon in the Activity Bar and press the **Setup** button
   - If the icon doesn't appear, open Command Palette (`Cmd+Shift+P`) → `Mentor Studio Code: Setup Mentor`

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

Claude Code を活用した AI メンター付きの VS Code 拡張。自分のプロジェクトの中で、理解度の確認・正答率の可視化・弱点トピックの追跡ができます。

> **注:** この拡張機能は [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) と合わせて使用することを前提としています。Claude Code のインストール・動作要件・利用可能なプランについては [Anthropic公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/overview) をご確認ください。
>
> **免責事項:** この拡張機能は独立したオープンソースプロジェクトであり、Anthropic, PBC との提携・推薦・後援関係はありません。「Claude」「Claude Code」は Anthropic の商標です。

## Quick Start

1. [VS Code](https://code.visualstudio.com/) 1.85.0+ と [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) をインストール
2. マーケットプレイスから [Mentor Studio Code](https://marketplace.visualstudio.com/items?itemName=nabetxan.mentor-studio-code) をインストール
3. アクティビティバーの Mentor Studio Code アイコンをクリックし、**Setup** ボタンを押す
   - アイコンが見つからない場合は、コマンドパレット（`Cmd+Shift+P`）→ `Mentor Studio Code: Setup Mentor`

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
