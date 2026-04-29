# Change Log

All notable changes to "Mentor Studio Code" will be documented in this file.

## [0.6.7] - 2026-04-29

### Fixed

- Overview refresh regression introduced in v0.6.6: question history and current-task changes written to the DB now appear in the Overview tab again immediately after the write completes.

## [0.6.6] - 2026-04-28

### Breaking

- **CLI:** when `workspaceId` is not present in `config.json`, the CLI now returns `workspace_not_initialized` instead of silently falling back to `.mentor/data.db`. Invoking the CLI in a workspace where Setup has not been run is now an explicit error.
- **Canonical DB path moved:** `.mentor/data.db` is **no longer the canonical DB path**. External tools and backup scripts that read `.mentor/data.db` directly must read the absolute path shown in the sidebar's **Data Location** section (or copy the file directly from the OS user-data directory).
- **`.mentor/.gitignore` is now distributed:** Setup writes a `.mentor/.gitignore`. If you previously committed files inside `.mentor/` (custom scripts, notes, etc.), they will be ignored after running Setup; add explicit `!<path>` exceptions to `.mentor/.gitignore` to keep tracking them.

### Changed

- **DB location moved:** `data.db` now lives in the OS user-data directory (outside the workspace). This eliminates the long-standing problem of `git pull` / `checkout` / `rebase` aborting mid-mentor-session because of changes to `.mentor/data.db`. New locations (`<workspaceId>` is `<sanitized-repositoryName>-<UUID>` so the directory is identifiable in your file manager):
  - macOS: `~/Library/Application Support/MentorStudioCode/<workspaceId>/data.db`
  - Linux: `$XDG_DATA_HOME/mentor-studio-code/<workspaceId>/data.db` (default: `~/.local/share/...`)
  - Windows: `%APPDATA%\MentorStudioCode\<workspaceId>\data.db`
- Migration runs **inside Setup**, not at activation. After upgrading, the sidebar shows a "Run Setup to migrate to v0.6.6" prompt (and a toast appears) when a legacy `.mentor/data.db` is detected. Running Setup copies it to the new location and renames the in-workspace file to `.mentor/data.db.migrated-YYYY-MM-DD` (kept as a safety copy — you can delete it manually after verifying the new history works). Mentor features (plan panel, file watcher, etc.) stay disabled until Setup completes the migration.
- Sidebar wording was tightened to match the current webview: Actions now use `Start task` / `Review implementation` / `Start review` / `Start Comprehension check`, and the Mentor ON/OFF toggle remains in the top navigation bar while Settings focuses on plan/spec/setup/data management.

### Added

- Setup writes `.mentor/.gitignore`, so newly-created data files are ignored by default.
- New sidebar section: **Data Location** shows the DB's absolute path with an "Open folder" button that reveals the directory in your OS file manager.
- New checkbox in the uninstall section: **Learning history DB (external storage)** (unchecked by default). Checking it and pressing "Delete Data" also removes the external DB.
- After Setup completes the v3 migration, if the legacy `.mentor/data.db` (or `.migrated-*`) is still tracked by git, a notification offers a one-click `git rm --cached` (the new `.mentor/.gitignore` is auto-staged so a single follow-up `git commit` finalizes the cleanup).

### Migration notes

- **Run Setup after upgrading to v0.6.6.** The sidebar will display a migration prompt and a toast notification will appear with a "Run Setup" button — click it (or invoke `Mentor Studio Code: Setup Mentor` from the command palette) to perform the v3 relocation. Mentor features stay inactive until Setup runs. This keeps the breaking move opt-in and avoids surprise file rewrites.
- For users who committed `.mentor/data.db`: an untrack notification appears immediately after Setup completes. Click "Untrack" → finalize with `git commit -m "Untrack legacy mentor DB"`. (The new `.mentor/.gitignore` is auto-staged, so a single commit completes the cleanup.)
- Setup performs the v3 migration **regardless of the `enableMentor` value** — disabling the mentor does not skip data preservation, since Setup is the path that owns the move. No internet connection is required (local file operations only).
- The renamed `.mentor/data.db.migrated-YYYY-MM-DD` file is **not deleted automatically**. After verifying the new DB works, you can delete it manually. (A future release may add automatic cleanup after a grace period.)
- **Skip-version upgrades supported:** upgrading directly from v0.5 to v0.6.6 works — v1 / v2 (schema-only) migrations still run automatically at activation, then the v3 prompt appears for the file relocation step. Note: the one-shot "v1 → SQLite migrated" info toast that v0.5 displayed has been removed in v0.6.6, so skip-version users won't see it (no functional impact).
- **Manual backup/restore in v0.6.6.** To back up, copy `data.db` from the path shown in the sidebar's Data Location section (or use the "Open folder" button to reveal it in your OS file manager). To restore, overwrite the same `data.db` and restart VSCode. Built-in Export/Import commands are planned for v0.7+.

### Known limitations (v0.6.6)

- **Workspace duplication / move is unsupported.** Cloning a workspace via `git worktree add` / `cp -r` / folder move shares the `workspaceId` inside `.mentor/config.json`. Using Mentor in multiple copies makes them write to the same external DB and mix state. **One workspace = one learning history** is the assumption. To use a separate history in a copy, delete the `workspaceId` field from the copy's `.mentor/config.json` and restart Mentor; a new id will be generated (the old external DB stays as an orphan — see below).
- **Deleting `.mentor/config.json` and re-running Setup orphans the old external DB.** Without `config.json`, re-running Setup generates a new `workspaceId`, and the external DB under the old id becomes an orphan (no detection or auto-recovery). If history disappears unexpectedly, look under `~/Library/Application Support/MentorStudioCode/` (macOS) etc. for the old `<repositoryName>-<UUID>` directory. A v0.7+ release is planned to enumerate existing external directories during Setup and offer recovery options.
- **Migration failure behavior:** on I/O errors (permissions, disk full, etc.) the migration fails, Mentor features are not activated, and an error message is shown. Resolving the underlying cause and restarting VSCode retries the migration (the design avoids infinite loops).

## [0.6.5] - 2026-04-23

### Added

- New `[flow:intake]` route in `MENTOR_RULES.md`. The Settings → Profile button now copies `[flow:intake] プロフィールを更新してください。` instead of referencing the skill file directly, giving the AI a flow-routed entry point and eliminating the need to reverse-engineer `mentor-cli session-brief` arguments on standalone invocation.
- Mid-cycle interruption handling in `mentor-session`: when a Teaching Cycle is interrupted before `(i) RECORD` (user pauses, switches topic, or ends the session), the AI now calls `update-progress` with a one-line hint — step number, cycle gate, and what is outstanding — before handing control away, so the next session can resume accurately.
- Session Start now reconciles `resume_context` against the workspace: when `resume_context` names specific files/symbols, the AI skims them to verify state; if code is already ahead of the recorded task state, it summarizes what is done and asks permission to update task status, `.mentor/current-task.md`, and `resume_context` before proceeding.

### Changed

- `intake` skill now fetches its own `session-brief` when invoked standalone via `[flow:intake]`. When invoked from `mentor-session`, it still reuses the caller's `session-brief` output as before — no duplicate CLI calls.
- Skill templates (`MENTOR_RULES.md`, `shared-rules.md`, `teaching-cycle-reference.md`, all `SKILL.md` files, `plan-health.md`, `CREATE_PLAN.md`, `CREATE_SPEC.md`) significantly compressed for token efficiency while preserving semantics. All existing gates, blocking rules, and CLI contracts are unchanged.

## [0.6.4] - 2026-04-22

### Added

- Intake skill now supports an **Update Flow**: when a learner profile already exists and the user asks to update it, the mentor first renders the saved profile as a Markdown table, then accepts free-text edit instructions with a diff-preview confirmation step before calling `update-profile`.

### Fixed

- Re-publish of features that were merged after the 0.6.3 marketplace build was packaged (Spec handoff flow, plan CRUD CLI commands, progress.json → DB migration resilience). Installing 0.6.4 and running Setup now propagates the up-to-date skill templates to existing workspaces.

## [0.6.3] - 2026-04-20

### Added

- Right-clicking a markdown file's editor tab now shows **Add to Mentor Plan** and **Add to Mentor Spec**, matching the existing Explorer context menu.
- Session start (plan-health) detects when the active plan's `filePath` looks like a Spec document (no `## Task N` headings, contains spec-style headings such as `## Overview` / `## Requirements` / `## Non-Goals`) and asks the user whether to convert it: the plan is moved to `removed` and the file is registered as `mentorFiles.spec`.
- New CLI commands: `deactivate-plan` (moves an active plan back to `queued`, demoting any active task) and `remove-plan` (soft-deletes a non-active plan to `removed`). Used internally by the new Spec-handoff flow; also available for AI/script use.

### Fixed

- Re-adding a file whose plan was soft-deleted now restores the existing row instead of silently failing with "already exists".
- Uninstall post-hook now reliably locates every workspace that has a `.mentor/config.json`, including those where the `MENTOR_RULES.md` reference was added to project `CLAUDE.md` only (previously such workspaces were skipped).
- Sidebar now flips to the "Run Setup" (no-config) view when the `.mentor/` folder is removed recursively on macOS, where fsevents can miss the individual `config.json` delete event.
- Reduced `ENOTEMPTY` errors when releasing the DB write lock by waiting for any in-flight heartbeat rename before removing the lock directory.

### Changed

- **SQLite schema bumped to v2.** `learner_profile` moved into a new append-only history table (one row per update, latest row wins on read) and `resume_context` moved into a new `app_state` key/value table. `.mentor/progress.json` is now obsolete: on first activation of v0.6.3, existing workspaces migrate their profile + resume context into the DB, back up the original to `.mentor/progress.json.bak`, then delete the live file. Fresh setups no longer create `progress.json`. Profile history (`learner_profile` rows) is retained going forward to support future time-series views; there is no automated pruning in this release.
- Settings "Change" (変更) and Explorer "Add to Mentor Plan" now reuse any existing row for the same file path (restoring `removed` rows to `backlog`). Settings activates the selected plan and demotes the prior active to `paused`. Explorer single-select / Plan Panel add to `backlog` and auto-activate only when no plan is currently active; Explorer bulk select (2+ files) never auto-activates — all added files stay in `backlog`.
- The "Delete Data" confirmation dialog no longer offers a one-click Uninstall button; it now directs the user to uninstall from the Extensions view. This avoids races between cleanup and the VS Code uninstall hook.

## [0.6.2] - 2026-04-18

### Fixed

- Bundled CLI renamed from `mentor-cli.js` to `mentor-cli.cjs` so it loads as CommonJS regardless of the host project's `package.json` `"type"` field. Previously, workspaces with `"type": "module"` failed.

## [0.6.1] - 2026-04-18

### Changed

- `mentor-cli.js` now embeds `sql-wasm.wasm` directly in the bundle. `.mentor/tools/` no longer ships a separate `sql-wasm.wasm` file, and Setup / re-Setup no longer copies it.
- Settings → Plan / Spec の「AIと作成」コピー用プロンプトを、特定スキル名への依存をやめ、利用可能な外部スキルがあれば活用する汎用的な文面に変更。

### Added

- `THIRD_PARTY_NOTICES.md` with attribution for sql.js, SQLite, Emscripten, React, and @dnd-kit. The `mentor-cli.js` bundle also inlines the sql.js / SQLite / Emscripten notices as a banner comment. Both README language sections link to the notices file from their License section.

## [0.6.0] - 2026-04-17

This release migrates the runtime data store from JSON files to SQLite, and rebuilds the Plan Panel around a richer plan lifecycle.

### ⚠️ Breaking Changes / Migration Notes

On first activation of v0.6.0, the extension automatically migrates existing workspaces:

- `.mentor/question-history.json` and parts of `.mentor/progress.json` are migrated into a new SQLite database at `.mentor/data.db`. The original `question-history.json` is deleted after a successful migration (content now lives in the DB); `config.json` / `progress.json` / `question-history.json` are preserved as `.bak` snapshots.
- `config.json` no longer stores `topics` or `mentorFiles.plan` — topics live in the DB, and the active plan is implied by the single plan row with `status = 'active'`. Writes to `mentorFiles.plan` from the Sidebar or `update-config` CLI are now rejected.
- `progress.json` is slimmed to `resume_context` and `learner_profile`. All task state (active task, completed/skipped tasks, unresolved gaps) now lives in the SQLite DB. Topic identifiers are auto-increment integers instead of string keys.
- Orphan history and pre-schema string tasks are bucketed under a synthesized "Legacy" plan so nothing is dropped.
- If you have external tooling reading these JSON files directly, switch to `mentor-cli` commands.

### Added

- **SQLite-backed runtime store** (`.mentor/data.db`) — topics, plans, tasks, and question history in a single DB with foreign-key integrity, status invariants, and integer IDs.
- **Plan Panel redesign** — single Plans pane with a 6-status lifecycle (`backlog`, `queued`, `active`, `completed`, `paused`, `removed`), collapsible status groups, consolidated status badge + dropdown, drag-and-drop reorder within Queued / Paused / Backlog, file-picker-based plan import, auto-promotion of the next queued plan on completion, and i18n (Japanese / English).
- **Explorer context menu: Add to Mentor Spec** — right-click a markdown file in the Explorer to set it as the active mentor spec (`mentorFiles.spec` in `.mentor/config.json`). If a spec is already set, a modal confirms replacement. Mirrors the existing **Add to Mentor Plan** entry.
- **Rebuilt mentor-cli** talking to SQLite — adds `add-plan` / `add-task` / `update-plan` / `delete-plan` / `activate-plan` / `activate-task` and enforces the "at most 1 active plan and 1 active task" invariant. `session-brief`, `list-unresolved`, `list-topics`, `list-plans`, `record-answer`, `update-task`, etc. now read/write the DB.
- **DB-backed dashboard** and broadcast bus to coalesce DB-change notifications to the webview.

### Changed

- `FileWatcher` rewritten around DB change events.
- `setup` bootstraps an empty `data.db`; `remove-mentor` cleans up SQLite runtime artifacts.
- Sidebar **Settings** plan UI consolidated into a single **Plan** card (active plan + next queued plan); "Open Plan Panel" moved to a separate inline card.

### Improved

- mentor-session happy-path context load reduced ~16% by splitting Plan Health Check into a separately-loaded `plan-health.md`.
- `shared-rules.md` deduplicated (merged overlapping "CLI Tool" and "Data Access Rule" sections).

### Removed

- Direct AI reads and writes to `question-history.json` — all question I/O goes through mentor-cli.
- `question-history.json` is no longer created on fresh setup, and is deleted after a successful legacy-workspace migration (the `.bak` is kept as a backup).
- Legacy `mentorCli` test suite and `.mentor/skills/mentor-session/tracker-format.md` (signatures inlined into `teaching-cycle-reference.md`).

### Fixed

- Active-task invariant enforced at the schema level (partial unique index on `tasks.status = 'active'`), preventing the "two active tasks" drift.
- Plan Panel now reflects sidebar-initiated plan changes immediately instead of waiting for a file-system event.

## [0.5.0] - 2026-04-11

### Added

- Review, Comprehension Check, and Implementation Review as separate skill files — each flow now has its own `SKILL.md` with dedicated "First Steps" for loading only the context it needs
- Shared rules file (`skills/shared-rules.md`) — BLOCKING RULE, CLI Tool, NEVER list, and External Skill Handoff extracted into a single shared reference loaded by all skills
- CLI tool (`tools/mentor-cli.js`) — Node.js CLI that handles backup and validation for `question-history.json`, `progress.json`, and `config.json`; AI must use CLI commands instead of directly editing these JSON files
- CLI `session-brief` command — returns flow-specific filtered data for session start, replacing raw file reads of progress.json and question-history.json
- CLI `list-unresolved` command — returns filtered and sorted unresolved gaps for mid-session review loops
- CLI `get-history-by-ids` command — returns specific question-history entries by ID
- `teaching-cycle-reference.md` — shared Feedback and RECORD procedure extracted from mentor-session SKILL.md, now referenced by all flows
- Task Skip and Task Completion flows moved into mentor-session SKILL.md for better discoverability

### Improved

- Setup command now writes all skill directories (review, comprehension-check, implementation-review, shared-rules), CLI tool (`tools/mentor-cli.js`), and re-enables `enableMentor` on re-setup
- MENTOR_RULES.md simplified — BLOCKING RULE moved to shared-rules.md; activation gate messaging now includes "Do not ask follow-up questions" for clearer stop behavior
- Context consumption reduced 58-88% depending on flow — AI no longer reads raw `progress.json` or `question-history.json`; all data access via filtered CLI commands
- Review, Comprehension Check, and Implementation Review load lightweight `teaching-cycle-reference.md` instead of full mentor-session SKILL.md
- RECORD procedure centralized in `teaching-cycle-reference.md` (previously duplicated in mentor-session steps (e) and (i))
- FileWatcher warns users with a notification when `progress.json` or `question-history.json` contains invalid JSON, instead of silently failing

## [0.4.0] - 2026-04-08

### Added

- Manual Setup from Settings — a "Setup (Manual)" section in the Settings tab lets users re-run setup directly from the UI, updating template files (rules, skills) to the latest version while preserving learning data

### Improved (AI Mentor Skills)

- Language-neutral prompts — all hardcoded Japanese strings in MENTOR_RULES, SKILL.md, intake questions, plan/spec creation, and status messages replaced with language-neutral instructions; the AI now dynamically translates based on `locale`, improving consistency and multi-language support
- Enhanced Feedback quality — Feedback categories (Correct / Close / Wrong) now include explicit criteria definitions; the AI must always ask "OK to proceed?" after feedback and wait for confirmation before recording
- Restructured RECORD step — changed from a flat list to a clearly ordered multi-step procedure: topic auto-addition, recording with schema validation, and post-record profile checks, reducing recording errors
- Stricter correctness judgment — `isCorrect: true` now explicitly requires "correct on first attempt without any hints, sub-questions, or explanations"; multi-turn answers recorded as `"[first answer] → (after hint) [final answer]"`
- Full feedback cycle for verification questions — step (h) upgraded from a simple "Wait" to a full Feedback step with hints and re-attempts, matching the rigor of step (d)
- BLOCKING RULE visibility — promoted to the top of MENTOR_RULES.md with added steps for proceed-confirmation and post-record evaluation order
- Simplified Language Rule — reduced to a concise instruction while preserving behavior
- Consolidated tracker format — field rules and ID format embedded directly in schema descriptions for clarity; removed redundant sections and examples

## [0.3.1] - 2026-04-07

### Added

- GitHub Actions workflow for automated VS Code Marketplace publishing on release

### Security

- Update vite to fix high-severity vulnerabilities (path traversal, `server.fs.deny` bypass, arbitrary file read)

## [0.3.0] - 2026-04-07

### Added

- Uninstall Guide in Settings — selective cleanup (`.mentor` folder, profile data, CLAUDE.md reference) with confirmation dialog before destructive actions, followed by optional one-click extension uninstall
- Safety check during Setup — detect pre-existing `.mentor` folder not created by this extension and warn before overwriting (irreversible)

### Changed

- Clarify that this extension is an independent project optimized for use with Claude Code, not affiliated with Anthropic — updated README, landing page, and app-specification
- Remove hardcoded subscription plan names (Claude Pro / Max); link to Anthropic's official documentation for current requirements and plans
- Add disclaimer and trademark attribution to README, landing page, and app-specification
- Replace "Remove Mentor" button with the new Uninstall Guide flow

### Fixed

- Clear `learnerProfile` from `globalState` when cleanup is executed with profile option selected
- Read locale from `.mentor/config.json` instead of relying solely on system locale for Remove Mentor / Cleanup dialogs
- Add safety check with `parseConfig` before modifying `config.json` to avoid corrupting invalid JSON

## [0.2.0] - 2026-04-05

### Added

- Learner profile global sync — `learner_profile` is now stored in VSCode's `globalState` and synced bidirectionally with each project's `progress.json` using `last_updated` timestamps (newer wins), so profile data persists across workspaces
- Merge Topics section in Overview tab — merge any topic into another (including new topics) independent of review status
- Delete Topics section in Overview tab with multi-select checkbox dropdown (topics with related data are disabled; hint guides user to merge first)
- Remove Mentor command to uninstall mentor configuration from a project
- Uninstall hook to disable mentor (`enableMentor: false`, `extensionUninstalled: true`) in `.mentor/config.json` when extension is uninstalled
- CLAUDE.md management service for adding/removing mentor rule references
- Settings UI with Remove Mentor button in sidebar
- Profile last updated date display in Settings tab

### Fixed

- Workspace handling in setup command and sidebar provider
- Hide sidebar icon in empty windows (no folder open) to prevent blank webview

### Changed

- Update GitHub Actions to latest versions (checkout@v5, configure-pages@v5, upload-pages-artifact@v4, deploy-pages@v5)

## [0.1.0] - 2026-04-04

- Pre-release
