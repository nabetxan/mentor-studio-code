# Change Log

All notable changes to "Mentor Studio Code" will be documented in this file.

## [0.6.0] - 2026-04-17

This release migrates the runtime data store from JSON files to SQLite, and rebuilds the Plan Panel around a richer plan lifecycle.

### ⚠️ Breaking Changes / Migration Notes

On first activation of v0.6.0, the extension automatically migrates existing workspaces:

- `.mentor/question-history.json` and parts of `.mentor/progress.json` are migrated into a new SQLite database at `.mentor/data.db`. Legacy files are preserved as `.bak`.
- `config.json` no longer stores `topics` or `mentorFiles.plan` — topics live in the DB, and the active plan is implied by the single plan row with `status = 'active'`. Writes to `mentorFiles.plan` from the Sidebar or `update-config` CLI are now rejected.
- `progress.json` is slimmed to `resume_context` and `learner_profile`. All task state (active task, completed/skipped tasks, unresolved gaps) now lives in the SQLite DB. Topic identifiers are auto-increment integers instead of string keys.
- Orphan history and pre-schema string tasks are bucketed under a synthesized "Legacy" plan so nothing is dropped.
- If you have external tooling reading these JSON files directly, switch to `mentor-cli` commands.

### Added

- **SQLite-backed runtime store** (`.mentor/data.db`) — topics, plans, tasks, and question history now live in a single database with foreign-key integrity, status invariants (unique active plan / active task), and integer IDs.
- **Plan Panel redesign** — single Plans pane (Tasks pane removed) with a 6-status lifecycle (`backlog`, `queued`, `active`, `completed`, `paused`, `removed`):
  - Plans are split into 6 collapsible status groups (Active → Queued → Paused → Backlog → Completed → Removed). Active / Queued / Paused / Backlog open by default; Completed / Removed are collapsed by default. Empty groups render dimmed and disabled.
  - Status changes consolidated into a single badge button + dropdown (the old Activate / Deactivate / Remove / Restore buttons are gone).
  - Drag-and-drop reorder is limited to the Queued / Paused / Backlog groups; the drag handle is hidden inside Active / Completed / Removed.
  - Added an active-plan conflict confirmation dialog (`vscode.window.showInformationMessage`) when the user activates a second plan.
  - Added i18n (Japanese / English). `initData.locale` flows through a React Context to every Plan Panel component.
  - "Add Plan from File…" uses the VS Code file picker; plan name is auto-derived from the markdown filename.
  - When the active plan completes, the next `queued` plan is auto-promoted (sortOrder ascending); `backlog` plans are never auto-promoted.
  - mentor-session skill detects `active` plans with `taskCount === 0` and offers to regenerate the plan file with a task breakdown.
- **Rebuilt mentor-cli** (`.mentor/tools/mentor-cli.js`) talking to SQLite:
  - `session-brief` — flow-specific filtered bundle (learner profile, current task, relevant gaps).
  - `list-unresolved`, `list-topics`, `list-plans` (returns `taskCount`; `removed` / `completed` hidden unless opted in).
  - `add-topic`, `record-answer`, `update-task` (auto-activates next queued task), `update-profile`, `update-progress`, `update-config`.
  - `add-plan`, `add-task`, `update-plan`, `delete-plan`, `activate-plan`, `activate-task` — task activation is enforced to keep the invariant "active task belongs to the active plan; at most 1 active plan and 1 active task". `add-task` auto-activates the first task under an active plan when no task is currently active; `activate-plan` cascades to activate the plan's first queued task under the same condition.
- **DB foundation** (`src/db/`) — DDL, `sql.js` loader, atomic writes, cross-process advisory lock, write transactions, integrity checks, status invariant assertions.
- **DB-backed dashboard** (`services/dbDashboard.ts`) and a broadcast bus (`services/broadcastBus.ts`) for coalescing DB-change notifications to the webview.
- **Test infrastructure** — mock VS Code file system watcher, end-to-end smoke tests for mentor-cli, and extensive unit coverage across DB, migration, CLI, and session-brief layers. Template validation tests for SKILL.md files.

### Changed

- `FileWatcher` rewritten around DB change events (legacy JSON parsing retained only for `progress.json` / `config.json` metadata).
- `setup` command copies the new `mentor-cli.js` bundle and bootstraps an empty `data.db` when none exists.
- `remove-mentor` cleanup also removes SQLite runtime artifacts (`data.db`, `data.db.lock`, `data.db.bak`, `sql-wasm.wasm`, bundled CLI).
- Sidebar **Settings** plan UI consolidated into a single **Plan** card that shows the active plan (with Change / Detach) and the next queued plan (file link only; Activate button appears only when no active plan). The "Open Plan Panel" button moves into a separate inline **Plan Panel** card. `DashboardData` gains a `nextPlan` field (the queued plan with the smallest `sortOrder`).

### Improved

- **Context consumption**: mentor-session happy-path load reduced ~16% by splitting Plan Health Check (Case A/B/C + status table) into `plan-health.md`, loaded only when `currentTask` is null or an active plan has no tasks.
- **shared-rules.md**: merged overlapping "CLI Tool" and "Data Access Rule" sections into a single canonical reference; removed redundant NEVER bullet.

### Removed

- Direct AI reads and writes to `question-history.json` — all question I/O goes through mentor-cli.
- Legacy `mentorCli` test suite (superseded by per-command and e2e tests).
- `.mentor/skills/mentor-session/tracker-format.md` is no longer written by Setup. Manual Setup re-runs on upgraded v0.5.0 installs automatically delete the stale file. The CLI command signatures that lived in this file are now inline in `teaching-cycle-reference.md`.

### Fixed

- Active-task invariant enforced at the schema level (partial unique index on `tasks.status = 'active'`), preventing the long-standing "two active tasks" drift when advancing from a queued task.
- Plan Panel now reflects sidebar-initiated plan changes (change/activate/deactivate/pause) immediately instead of waiting for a file-system event that could be delayed or missed for atomic-rename writes.

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
