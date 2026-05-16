# Context

## Product

Mentor Studio Code helps users learn inside their own projects. It combines a VS Code extension UI, AI entrypoint prompts, a bundled CLI, and SQLite-backed learning history.

## Domain Terms

- Mentor Entrypoint: `CLAUDE.md` / `AGENTS.md` wiring that loads `.mentor/rules/MENTOR_RULES.md`.
- Setup: creates `.mentor/`, prompt templates, the CLI tool, config, and the external DB.
- Plan: DB-managed learning unit. Status: `active`, `queued`, `paused`, `completed`, `backlog`, `removed`.
- Task: DB-managed step under a Plan. Status: `active`, `queued`, `completed`, `skipped`; `skipped` means the step was closed without doing it, and can be moved back to `queued` if the user decides to revisit it. Task deletion is not a Task status; it is a low-level physical cleanup for mistaken Task registration and is separate from the normal Task lifecycle.
- Current Task: `.mentor/current-task.md`, AI-written working note for the active task.
- Task Completion: Mentor session / CLI operation that marks the active Task `completed` or `skipped` and auto-advances to the next queued Task when one exists.
- Task State Sync: Plan Panel operation for manually correcting Task status/order. It does not auto-advance; if no active Task remains, the next Mentor session startup repairs that state through Plan Health Check.
- Topic: learning category used by questions and weak-area tracking.
- Question / Gap: recorded answer history. `isCorrect=false` is an unresolved Gap.
- Learner Profile: experience, level, interests, weak areas, and mentor style.
- Plan Orientation Map: optional visual/text map created once when a new active Plan starts.

## Architecture Map

- `extension/src/extension.ts`: activation, commands, runtime wiring.
- `extension/src/commands/setup.ts`: Setup flow, prompt/template installation, DB bootstrap.
- `extension/src/templates/mentorFiles.ts`: source of generated Mentor prompt files.
- `extension/src/services/fileWatcher.ts`: watches config/DB and refreshes sidebar data.
- `extension/src/views/sidebarProvider.ts`: sidebar webview bridge.
- `extension/src/panels/planPanel.ts`: Plan Panel webview bridge.
- `extension/src/cli`: AI-facing CLI for DB/config reads and writes.
- `extension/src/db`: sql.js persistence, transactions, locks, invariants.
- `packages/shared`: shared DTOs and message types.

## Prompt Design Principles

- Keep Mentor templates compact; tests enforce word-count budgets.
- Prefer improving existing generated prompt files over adding more files.
- Avoid copy-from-explanation quizzes.
- Ask code-grounded questions only when they reduce learning risk.
- Pace by learning risk: `skim`, `guided`, `deep`.
- One code burst should have one teaching purpose.
- Do not split prompt rules into extra files unless reuse or token savings justify it.
