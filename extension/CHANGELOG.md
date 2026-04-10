# Change Log

All notable changes to "Mentor Studio Code" will be documented in this file.

## [0.5.0] - 2026-04-10

### Added

- Review, Comprehension Check, and Implementation Review as separate skill files — each flow now has its own `SKILL.md` with dedicated "First Steps" for loading only the context it needs
- Shared rules file (`skills/shared-rules.md`) — BLOCKING RULE, File Write Safety, NEVER list, and External Skill Handoff extracted into a single shared reference loaded by all skills
- File Write Safety rules — backup before editing JSON, never use shell read-and-write on the same file, validate JSON after every write
- Write Mechanism in tracker-format — explicit Edit-tool-based append procedure for `question-history.json`
- Task Skip and Task Completion flows moved into mentor-session SKILL.md for better discoverability

### Improved

- Setup command now writes all skill directories (review, comprehension-check, implementation-review, shared-rules) and re-enables `enableMentor` on re-setup
- MENTOR_RULES.md simplified — BLOCKING RULE moved to shared-rules.md; activation gate messaging now includes "Do not ask follow-up questions" for clearer stop behavior
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
