# Change Log

All notable changes to "Mentor Studio Code" will be documented in this file.

## [0.6.0] - 2026-04-14

### Added

- SQLite-backed runtime data store (`.mentor/data.db`) — topics, plans, tasks, and question history now live in a single SQLite database with foreign-key integrity, status invariants (unique active plan / active task), and auto-incrementing integer IDs, replacing the JSON-based `question-history.json` and parts of `progress.json`
- One-time JSON-to-SQLite migration — on first activation of v0.6.0 with a legacy workspace, the extension detects `question-history.json`, backs up legacy files (`.bak`), builds `data.db`, rewrites `progress.json` to a slimmed-down shape (task IDs as integers, `unresolved_gaps` and `completed_tasks`/`skipped_tasks` removed — now derived from the DB), and strips `topics` and `mentorFiles.plan` from `config.json`
- Legacy-plan synthesis during migration — pre-schema string task entries and orphan history are bucketed under a synthesized "Legacy" plan so nothing is dropped
- Rebuilt mentor-cli (`.mentor/tools/mentor-cli.js`) with a new command surface talking to SQLite:
  - `session-brief '{"flow":"mentor-session|review|comprehension-check|implementation-review","topicId":<id?>}'` — flow-specific filtered bundle (learner profile, current task, relevant gaps, etc.)
  - `list-unresolved '{"topicId":<id?>,"limit":<n?>}'` — unresolved gaps sorted by `lastAnsweredAt`
  - `list-topics` — all topics with their integer IDs
  - `add-topic '{"label":"..."}'` — insert a topic, returns the new integer ID
  - `record-answer '{...}'` — insert a new question row, or update an existing one when `id` is passed (used for review cycles / gap resolution)
  - `update-task '{"id":<n>,"status":"completed|skipped"}'` — advances task status and auto-activates the next queued task under the same plan; syncs `current_task` in `progress.json`
  - `update-profile '{...}'` — partial update of `learner_profile` with `last_updated` stamping
  - `update-progress '{"current_step":...,"resume_context":...}'` — partial update of transient progress fields
  - `update-config '{"mentorFiles":{...}}'` — safe partial config edits
- DB foundation modules (`src/db/`) — schema + DDL, `sql.js` loader, atomic writes, cross-process advisory lock, write transactions, integrity checks, and status invariant assertions
- DB-backed dashboard service (`services/dbDashboard.ts`) and progress healing (`services/progressHealing.ts`) to keep the webview and `progress.json` consistent with DB state
- Broadcast bus (`services/broadcastBus.ts`) for coalescing DB-change notifications to the webview
- Mock VS Code file system watcher for deterministic tests
- End-to-end smoke tests for mentor-cli and extensive unit tests across the DB, migration, CLI command, and session-brief layers
- Template validation tests for SKILL.md files

### Changed

- `progress.json` is now a thin file holding only `current_task` (integer task ID), `current_step`, `resume_context`, and `learner_profile`; `completed_tasks`, `skipped_tasks`, and `unresolved_gaps` are derived from the DB on demand
- `config.json` no longer stores `topics` or `mentorFiles.plan` — topics live in the DB, and the active plan is implied by the single plan row with `status = 'active'`
- Task and topic identifiers are integers (DB auto-increment) instead of string keys; all CLI commands and the migration take integer IDs
- `FileWatcher` rewritten around DB change events (with legacy JSON parsing kept only for progress/config metadata)
- `setup` command copies the new `mentor-cli.js` bundle and bootstraps an empty `data.db` when none exists
- `remove-mentor` cleanup now also removes DB artifacts and `.bak` files

### Removed

- Direct AI reads and writes to `question-history.json` — all question I/O goes through mentor-cli
- Legacy `mentorCli` test suite (superseded by per-command and e2e tests)

### Fixed

- Active-task invariant enforced at the schema level (partial unique index on `tasks.status = 'active'`), preventing the long-standing "two active tasks" drift that could occur when advancing from a queued task

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
