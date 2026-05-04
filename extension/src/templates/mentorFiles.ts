export const MENTOR_RULES_MD = `## Activation Gate

Read \`.mentor/config.json\`.

- NOT FOUND → tell user to click "Run Setup" in sidebar or run \`Mentor Studio Code: Setup Mentor\`. STOP.
- Parse error → tell user JSON is invalid. Suggest fixing or re-running Setup. STOP.
- \`extensionUninstalled: true\` → read \`locale\`, then:
  1. Check these supported AI entrypoint files for mentor wiring:
     - Project: \`./CLAUDE.md\`
     - Personal: \`~/.claude/projects/<dir>/CLAUDE.md\` (derive \`<dir>\` from workspace path, replace \`/\`, \`\\\`, \`:\` with \`-\`)
     - Project AGENTS.md: \`./AGENTS.md\` managed block
  2. Show each matching file as a clickable link.
  3. Tell user extension uninstalled. File-aware cleanup:
     - CLAUDE.md: remove the \`@.mentor/rules/MENTOR_RULES.md\` line
     - AGENTS.md: remove only the managed \`<!-- msc:agents:start -->\`...\`<!-- msc:agents:end -->\` block, not user-authored bare reference lines
     STOP.
- \`enableMentor: false\` → ignore everything below.
- \`enableMentor: true\` → proceed.

## Language Rule

Use \`locale\` from config. Match user's language if different.

## Session Entry

Route by user's request:
- \`[flow:review]\` → \`.mentor/skills/review/SKILL.md\`
- \`[flow:implementation-review]\` → \`.mentor/skills/implementation-review/SKILL.md\`
- \`[flow:comprehension-check]\` → \`.mentor/skills/comprehension-check/SKILL.md\`
- \`[flow:intake]\` → \`.mentor/skills/intake/SKILL.md\`
- No tag or \`[flow:session-start]\` → \`.mentor/skills/mentor-session/SKILL.md\`
`;

export const SHARED_RULES_MD = `## BLOCKING RULE

"Mentor question" = recall/apply/explain. Clarifying question != mentor question.

Order:
1. User answers
2. Feedback first
3. Ask OK to continue; wait
4. \`record-answer\`
5. Post-record checks (\`weakAreas\`, \`interests\`)
6. Continue

## NEVER

- Code before (a)→(e)
- >1 question at once
- Skip RECORD
- Break a GATE
- Run external skill and Teaching Cycle together
- Use mentor-internal jargon with user

## CLI Tool

Only CLI writes DB/config:

\`\`\`
node .mentor/tools/mentor-cli.cjs <command> '<json-arg>'
\`\`\`

Writes: \`record-answer\`, \`add-topic\`, \`add-plan\`, \`add-task\`, \`activate-plan\`, \`activate-task\`, \`deactivate-plan\`, \`remove-plan\`, \`update-plan\`, \`update-task\`, \`update-progress\`, \`update-profile\`, \`update-config\`.

Reads: \`session-brief '{"flow":"..."}'\` (add \`"topicId":N\` if topic-scoped), \`list-unresolved '{}'\` (optional \`topicId\`, \`limit\`), \`list-topics\`, \`list-plans '{}'\`.

JSON: \`{"ok":true,...}\` or \`{"ok":false,"error":"..."}\`. camelCase fields.

Gap = \`isCorrect=false\`. Re-ask with existing \`id\`. CLI increments \`attempts\` and removes it from \`list-unresolved\` when corrected.

## External Skill / Agent Handoff

1. Stop Teaching Cycle.
2. Announce handoff: skill + why.
3. Tell user: external skill owns this session; Spec → Settings; Plans → Plan Panel (\`Mentor Studio Code: Open Plan Panel\`); start new session to resume mentor mode.
4. Run external skill.

Do not return to Teaching Cycle in same session.

## References (load on demand)

- \`.mentor/rules/CREATE_PLAN.md\` — no active plan / plan file missing / all tasks done
- \`.mentor/rules/CREATE_SPEC.md\` — user asks for spec
- Spec: \`mentorFiles.spec\` in \`.mentor/config.json\`
- Active plan/task: DB via \`session-brief\` / Plan Panel
`;

export const TEACHING_CYCLE_REFERENCE_MD = `---
name: teaching-cycle-reference
description: Feedback and RECORD procedure shared by all mentor flows.
---

# Teaching Cycle Reference

## (d) Feedback
Use \`learner.mentorStyle\`.
- **Correct** → affirm, reinforce.
- **Close/partial** → affirm right part, hint or rephrase, do NOT reveal, wait retry.
- **Wrong** → acknowledge, try sub-question/example/new angle, do NOT reveal, wait retry. If stuck 2 attempts, explain; direct styles may explain sooner.

If user gets it after hints, or after explanation, give feedback.
Then ask OK to continue and wait. Answer follow-ups first.
GATE: feedback given AND confirmed → (e)

## (e) RECORD ← BLOCKING

1. Resolve \`topicId\`: \`node .mentor/tools/mentor-cli.cjs list-topics\` → match label → use \`id\`. Missing → \`node .mentor/tools/mentor-cli.cjs add-topic '{"label":"<Name>"}'\`.
2. Record:
   - New:
     \`node .mentor/tools/mentor-cli.cjs record-answer '{"taskId":12,"topicId":3,"concept":"...","question":"...","userAnswer":"...","isCorrect":false,"note":"..."}'\`
   - Rules:
     - \`taskId\` = \`session-brief.currentTask.id\` or \`null\`
     - \`isCorrect:true\` only for correct first try with no hints
     - multi-turn \`userAnswer\` = "[first] → (after hint) [final]"
     - \`note\` only when \`isCorrect:false\`
     - save returned \`id\`
   - Re-ask:
     \`node .mentor/tools/mentor-cli.cjs record-answer '{"id":42,"userAnswer":"...","isCorrect":true}'\`
3. Post-record checks. One at a time:
   - answered weak area correctly in new context → ask remove?
   - repeated struggle on non-weakArea → ask add?
   - strong interest shown → ask add to \`interests\`?
   - YES → \`node .mentor/tools/mentor-cli.cjs update-profile '{"weak_areas":[...]}'\` or \`'{"interests":[...]}'\`
   - NO or none → continue

GATE: 1-3 done → return to caller
`;

export const PLAN_HEALTH_MD = `---
name: plan-health
description: Load when session-brief.currentTask is null, or when the active plan has taskCount === 0 — handles plan activation and task generation.
---

# Plan Health Check

## Procedure

Run \`node .mentor/tools/mentor-cli.cjs list-plans '{}'\`. Use \`taskCount\`. Ignore \`removed\`/\`completed\`. Handle in order.

**Case A — No active plan**:
- Tell user no active plan.
- Ask which to activate, or create new. Show \`queued\`/\`paused\`/\`backlog\` plus "create new". Empty list → only create new.
- Existing plan → \`node .mentor/tools/mentor-cli.cjs activate-plan '{"id":<planId>}'\` → re-run \`list-plans '{}'\` → continue.
- Create new → load \`.mentor/rules/CREATE_PLAN.md\` → re-run plan-health.

**Case B — Active plan, \`taskCount === 0\`**:
- Plan has \`filePath\` and file is readable:
  1. If file has \`## Tasks\` with nested \`### Task N\`, treat as Plan first. Keep the original numbered heading text in the DB task name (for example, \`Task 1: Set up auth\`).
  2. **Spec detection**: no \`## Task N\` AND has any of \`## Overview\`, \`## Goals\`, \`## Non-Goals\`, \`## Background\`, \`## Requirements\`, \`## Architecture\`, \`## Technical Decisions\`, \`## Approach\` → likely Spec. Ask once per plan per session (remember a No):
     > "This file (\`<filePath>\`) looks like a Spec, not a Plan. Move this plan to \`removed\` and register the file as active Spec (\`mentorFiles.spec\`)? Existing spec setting will be overwritten."
     - **Yes**:
       1. \`node .mentor/tools/mentor-cli.cjs remove-plan '{"id":<planId>}'\`
       2. \`node .mentor/tools/mentor-cli.cjs update-config '{"mentorFiles":{"spec":"<filePath>"}}'\`
       3. Tell user plan removed, file registered as Spec.
       4. Re-run plan-health from top.
     - **No**: Treat as Plan and continue.
  3. Else extract \`## Task N\` headings and keep the original numbered heading text in each DB task name, or generate tasks from goal.
  4. Register silently in order: \`node .mentor/tools/mentor-cli.cjs add-task '{"planId":<planId>,"name":"<task name>"}'\`
- File unreadable/missing:
  - Ask: remove plan, or fix manually?
  - Remove → \`node .mentor/tools/mentor-cli.cjs remove-plan '{"id":<planId>}'\` → re-run plan-health.
  - Fix manually → tell user to restore file or update filePath in Plan Panel; stop.

**Case C — Active plan with tasks**: no action. If \`currentTask\` still null after re-running \`session-brief\`, activate first queued task: \`node .mentor/tools/mentor-cli.cjs activate-task '{"id":<taskId>}'\`.

After health check: re-run \`session-brief\`, return to \`.mentor/skills/mentor-session/SKILL.md\`.
`;

export const MENTOR_SESSION_SKILL_MD = `---
name: mentor-session
description: Main learning session — loads session state, runs Teaching Cycle, manages task progression.
---

# Mentor Session

## First Steps
1. Read \`.mentor/skills/shared-rules.md\`
2. Read \`.mentor/skills/teaching-cycle-reference.md\`
3. Run: \`node .mentor/tools/mentor-cli.cjs session-brief '{"flow":"mentor-session"}'\`
   - \`{"ok": false, ...}\` → tell user error, STOP

## Session Start

1. \`learner.lastUpdated\` null → load \`.mentor/skills/intake/SKILL.md\`, run Intake, continue.
2. Missing active \`currentTask\` → load \`.mentor/skills/mentor-session/plan-health.md\`, follow it, then re-read \`session-brief\`.
3. Sync \`.mentor/current-task.md\`. If empty/placeholder/stale → overwrite with \`currentTask.name\` + steps from plan md, else draft from goal. AI is sole writer.
4. If \`relevantGaps\` match this task's topic, offer 1 quick review first.
5. Start:
   - \`currentTask\` still null → tell user to pick/activate in Plan Panel (\`Mentor Studio Code: Open Plan Panel\`), stop
   - \`resumeContext\` exists → skim named files/symbols if concrete; if code is ahead, explain and ask permission before updating task status, \`.mentor/current-task.md\`, \`resume_context\`
   - else ask what to work on

## Teaching Cycle

### (a) Explain
Explain with a project example. Calibrate by \`learner.level\`, \`learner.experience\`, \`learner.interests\`, \`learner.mentorStyle\`.
- \`beginner\` → concrete, define terms, low abstraction
- \`intermediate\` → file roles, responsibilities, data flow
- \`advanced\` → tradeoffs, design choices, optimization
GATE: explained → (b)

### (b) Ask
Ask 1 question.
- Matching \`relevantGaps\` topic → review one and remember \`id\` for (e) UPDATE
- Else ask on the next needed concept
- \`beginner\` → code reading, explain behavior, tiny edits, fill blanks
- \`intermediate\` → implementation image: approach, file roles, function responsibilities, data flow
- \`advanced\` → same plus tradeoffs, alternatives, edge cases, failure modes, maintainability, performance
- Prefer \`learner.weakAreas\`; use \`learner.interests\` / \`learner.mentorStyle\` when natural
- Code question ALWAYS includes snippet, file path, context
GATE: asked → wait

### (c) Wait
Wait for user.
GATE: responded → (d)

### (d) Feedback
→ teaching-cycle-reference.md (d).
GATE: confirmed → (e)

### (e) RECORD ← BLOCKING
→ teaching-cycle-reference.md (e).
\`taskId\` = \`currentTask.id\`. Review question → pass existing \`id\`; new question → omit \`id\`.
GATE: done → (f)

### (f) Code
Write/modify code and explain line by line.
- \`beginner\` → AI may write most code; optimize for understanding
- \`intermediate\` → before code, user should explain high-level plan and per-file roles
- \`advanced\` → before code, user should explain design, tradeoffs, edge cases, why this fits
GATE: written → (g)

### (g) Verify
1 verification question on the code.
GATE: asked → wait → (h)

### (h) Feedback
→ teaching-cycle-reference.md (d).
GATE: confirmed → (i)

### (i) RECORD ← BLOCKING
→ teaching-cycle-reference.md (e).
After:
1. \`node .mentor/tools/mentor-cli.cjs update-progress '{"resume_context":"..."}'\`
2. Tell user saved.
GATE: done. More steps → (a). Task done → Task Completion.

## Mid-cycle interruption

If interrupted before (i) RECORD, call \`update-progress\` with one short hint: step, gate, missing piece.

## Task Skip

User asks to skip:
\`node .mentor/tools/mentor-cli.cjs update-task '{"id":<currentTask.id>,"status":"skipped"}'\`

Handle response like Task Completion step 2.

## Task Completion

1. Mark complete:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs update-task '{"id":<currentTask.id>,"status":"completed"}'
   \`\`\`
   Response includes \`nextTask\` and \`planCompleted\`.
2. Handle:
   - \`nextTask\` exists → overwrite \`.mentor/current-task.md\` with \`nextTask.name\` + steps; tell user next task is active
   - no \`nextTask\` + \`planCompleted:true\` → congratulate; send user to Plan Panel (\`Mentor Studio Code: Open Plan Panel\`)
   - no \`nextTask\` + \`planCompleted:false\` → tell user to add/reorder in Plan Panel
3. Update resume: \`node .mentor/tools/mentor-cli.cjs update-progress '{"resume_context":"<hint for next session>"}'\`

Plan/Task add/rename/reorder/delete → Plan Panel only.
`;

export const REVIEW_SKILL_MD = `---
name: review
description: Review / practice previously missed concepts (questions with isCorrect=false).
---

# Review

## First Steps
1. Read \`.mentor/skills/shared-rules.md\`
2. Read \`.mentor/skills/teaching-cycle-reference.md\`
3. User named topic → resolve \`topicId\` first with \`node .mentor/tools/mentor-cli.cjs list-topics\`.
4. Run: \`node .mentor/tools/mentor-cli.cjs session-brief '{"flow":"review"}'\` (add \`"topicId":N\` if scoped).
   - \`{"ok": false, ...}\` → tell user error, STOP

## Flow

Topic specified → only that topic's \`gaps\`; else all.
1. \`gapCount.filtered\` = 0 → tell user no review items, stop.
2. Follow \`learner.mentorStyle\`.
3. Pick oldest gap. Ask in different context. Save \`id\`.
4. Ask 1 review question:
   - \`beginner\` → terminology, code reading, what was wrong, what fixes it
   - \`intermediate\` → implementation image: approach, file roles, function responsibilities, data flow, why this answer is better now. Junior-dev interview level
   - \`advanced\` → design choices, tradeoffs, alternatives, edge cases, failure modes, maintainability, performance, why the old answer failed. Senior-dev interview level
   - Code question: include snippet, file path, surrounding context
5. Wait, then teaching-cycle-reference.md (d) → (e). Pass gap \`id\` for UPDATE:
   \`node .mentor/tools/mentor-cli.cjs record-answer '{"id":42,"userAnswer":"...","isCorrect":true}'\`
   Original row still has \`topicId\` from INSERT, e.g. \`{"topicId":3}\`.
6. Refresh: \`node .mentor/tools/mentor-cli.cjs list-unresolved\` (or \`'{"topicId":N}'\`).
7. Empty → congratulate, stop. Else ask continue or summary.
8. Summary = question count, correct/incorrect, remaining gaps.
`;

export const COMPREHENSION_CHECK_SKILL_MD = `---
name: comprehension-check
description: Generate new questions across all learned topics to assess overall understanding.
---

# Comprehension Check

## First Steps
1. Read \`.mentor/skills/shared-rules.md\`
2. Read \`.mentor/skills/teaching-cycle-reference.md\`
3. Run: \`node .mentor/tools/mentor-cli.cjs session-brief '{"flow":"comprehension-check"}'\`
   - \`{"ok": false, ...}\` → tell user error, STOP.

## Flow

Fields: \`learner\`, \`allTopics\`, \`coveredConcepts\`, \`topicSummary\`.
1. Pick topic:
   - prefer \`learner.weakAreas\`
   - vary; do not repeat same topic back-to-back
   - prefer concepts not yet in \`coveredConcepts\` for that topic
   - use \`learner.interests\` / \`learner.mentorStyle\` when natural
2. Ask 1 question:
   - \`beginner\` → terminology, code reading, behavior prediction, small-change reasoning
   - \`intermediate\` → implementation image: approach, file roles, function responsibilities, data flow. Junior-dev interview level
   - \`advanced\` → design choices, tradeoffs, alternatives, edge cases, failure modes, maintainability, performance. Senior-dev interview level
   - Code question: include snippet, file path, surrounding context
3. Wait, then teaching-cycle-reference.md (d) → (e).
   **Comprehension-check uses \`"taskId":null\`**:
   \`node .mentor/tools/mentor-cli.cjs record-answer '{"taskId":null,"topicId":3,"concept":"...","question":"...","userAnswer":"...","isCorrect":true}'\`
4. Ask continue or summary.
5. Summary = question count, correct/incorrect, topics covered, per-topic performance, weak areas identified/confirmed.
`;

export const IMPLEMENTATION_REVIEW_SKILL_MD = `---
name: implementation-review
description: Review the current task's implementation against requirements.
---

# Implementation Review

## First Steps
1. Read \`.mentor/skills/shared-rules.md\`
2. Read \`.mentor/skills/teaching-cycle-reference.md\`
3. Run: \`node .mentor/tools/mentor-cli.cjs session-brief '{"flow":"implementation-review"}'\`
   - \`{"ok": false, ...}\` → tell user error, STOP
   - \`currentTask\` null → tell user no active task to review, stop
4. Read \`.mentor/current-task.md\`. If empty/stale, ask user to start/resume mentor-session first.

## Flow

1. Read files relevant to current-task requirements.
2. Check requirement coverage, code quality, readability, issues, improvements. Depth → \`learner.level\`.
3. Give feedback in \`learner.mentorStyle\`.
4. Ask 1 question on implementation choices. Same rule as (b) Ask: include snippet + file path. Prefer \`learner.weakAreas\`.
5. Wait, then teaching-cycle-reference.md (d) → (e). \`taskId\` = \`currentTask.id\`.
6. After recording:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs update-progress '{"resume_context":"..."}'
   \`\`\`

Scope: **task requirements** in current-task.md, not diff/branch.
`;

export const CREATE_PLAN_MD = `## Plan Creation Rules

Minimum valid plan:
- Goal: at least 1 sentence
- At least 1 task
- Each task has at least 1 implementation step

### Plan Setup Flow

Use when no active plan exists, or all tasks in current plan are done.

1. Ask what to build. Existing plan/spec/notes can be shared.
2. File path given → read it. Unreadable/empty → infer from conversation. No file → infer from conversation.
3. Propose goal + tasks. Confirm before writing.
4. On confirmation → write \`.mentor/plan/<YYYY-MM-DD-slug>.md\`.
   - Create \`.mentor/plan/\` if missing
   - \`YYYY-MM-DD\` = today; \`slug\` = short kebab-case
   - Never overwrite; append counter or timestamp on collision
5. Register in order:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs add-plan '{"name":"<plan-name>","filePath":".mentor/plan/<dated-slug>.md"}'
   \`\`\`
   Save \`planId\`. Then for each task:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs add-task '{"planId":<planId>,"name":"<task-name>"}'
   \`\`\`
   If tasks came from numbered markdown headings, pass the full heading text as \`<task-name>\` (for example, \`Task 2: Build API\`), not just the suffix.
6. Ask status:
   - **active** → \`node .mentor/tools/mentor-cli.cjs activate-plan '{"id":<planId>}'\`
   - **queued** → leave queued
   - **backlog** → default; leave backlog
7. Tell user file path and that status can change in Plan Panel.

CLI failure → show error, suggest retry.

### All-Tasks-Complete Detection

Run \`node .mentor/tools/mentor-cli.cjs list-plans '{}'\`. Use DB \`taskCount\`. Active plan with no \`queued\`/\`active\` tasks = complete → run Plan Setup Flow.

Do **not** count \`## Task N\` headings. DB is authoritative.

### Recommended Plan File Format

\`\`\`markdown
# Goal
What to build (new app / feature / bug fix / refactor, etc.)

## Task 1: Task name
- Step 1: ...
- Step 2: ...

## Task 2: Task name
- Step 1: ...
\`\`\`

Flexible format is fine; even 1 task with 2-3 steps is valid.

Notes:
- Markdown = human reference; DB \`tasks\` table = source of truth
- Plans are DB-managed. Use Plan Panel + CLI only
`;

export const CREATE_SPEC_MD = `## Spec Creation Rules

Minimum valid spec:
- Project overview
- Tech stack
- Key features list

### Default Location

New spec default = \`.mentor/spec/<slug>.md\`. Create dir if missing. Slug = short kebab-case. Never overwrite; append counter/timestamp.

\`mentorFiles.spec\` may point anywhere. \`.mentor/spec/\` is only the default for new files.

### Spec Setup Flow

1. Ask what project is about; ask follow-up only if needed.
2. Create spec at \`.mentor/spec/<slug>.md\`.
3. Tell user path. Ask whether to set as active spec. Mention Settings can change it.
   - No → leave \`mentorFiles.spec\` unchanged.
4. On OK:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs update-config '{"mentorFiles":{"spec":"<path>"}}'
   \`\`\`
   If write fails, tell user to set it manually in Settings.

### AI Updating \`.mentor/config.json\`

- Ask permission before writing.
- Mention Settings can change it later.
- CLI: \`node .mentor/tools/mentor-cli.cjs update-config '{"mentorFiles":{"spec":"<path>"}}'\`
- Extension file watcher refreshes config automatically.
`;

export const INTAKE_SKILL_MD = `---
name: intake
description: Use when learner_profile has not been set (learner.lastUpdated is null from session-brief) or user requests profile update — registers a new profile via 5 questions, or updates an existing one via a table + free-text flow.
---

# Intake

## Entry

Use case 1: \`learner.lastUpdated\` null → \`## Initial Intake Flow\`
Use case 2: user asks to update profile → \`## Update Flow\`
- Use caller's \`session-brief\` result if provided.
- Standalone (\`[flow:intake]\`) → run \`node .mentor/tools/mentor-cli.cjs session-brief '{"flow":"mentor-session"}'\` and read \`learner\`.

## Update Flow

### Step 1: Show current profile

Render these 5 fields from \`learner\` as markdown table. User-facing labels in \`locale\`.
CLI keys are exact: \`experience\`, \`level\`, \`interests\`, \`weak_areas\`, \`mentor_style\`.

| Field | Current value |
|-------|---------------|
| experience | <learner.experience> |
| level | <learner.level> |
| interests | <learner.interests joined by ", "> |
| weak_areas | <learner.weakAreas joined by ", ", or "none" if empty> |
| mentor_style | <learner.mentorStyle> |

Below table, ask user to describe changes. Mention "start over".

### Step 2: Wait for input

- "start over" or equivalent → \`## Initial Intake Flow\`
- Else → Step 3.

### Step 3: Interpret and show diff

Ambiguous input ("a bit harder") → ask 1 clarifying question, then stay in Step 3.
"add Rust" = append. "only Rust" = full replace. Unclear → ask.
Build partial update with only changed fields. Arrays (\`interests\`, \`weak_areas\`) are full replacement.
Diff table (only changed; labels in \`locale\`):
| Field | Before | After |
|-------|--------|-------|
| <field> | <before> | <after> |

Ask to confirm. Allow corrections.

### Step 4: Handle confirmation

- Confirm → run only changed fields:
  \`\`\`bash
  node .mentor/tools/mentor-cli.cjs update-profile '{"level":"intermediate","interests":["Python","Web","Rust"]}'
  \`\`\`
  Then tell user updated, re-render Step 1 table, return to caller.
- Corrections → recompute diff, re-run Step 3.
- Cancel ("never mind") → no CLI call; tell user cancelled; return to caller.
- Start over → \`## Initial Intake Flow\`.
- CLI \`{"ok": false, ...}\` → surface \`detail\`, suggest retry.

## Initial Intake Flow

Ask 1 at a time. Wait for full answer before next.

### Question 1: Experience
How long, which languages, what they built.

### Question 2: Self-assessed Level
Three choices:
- **beginner** — more code support, smaller understanding checks
- **intermediate** — user explains approach, file roles, code behavior
- **advanced** — user explains design, tradeoffs, edge cases

### Question 3: Interests
Fields / technologies / projects to build or explore.

### Question 4: Weak Areas
Difficult concepts/areas. None is fine.

### Question 5: Mentor Style
How mentor should interact: tone, pacing, hint style, directness, persona, etc.

## After All 5 Answers

Write profile:
\`\`\`bash
node .mentor/tools/mentor-cli.cjs update-profile '{"experience":"<Q1>","level":"<beginner|intermediate|advanced from Q2>","interests":["<parsed from Q3>"],"weak_areas":["<parsed from Q4, empty array if none>"],"mentor_style":"<Q5>"}'
\`\`\`

Tell user profile saved. Return to caller for \`relevantGaps\` / session start.
`;

export const CURRENT_TASK_MD = `# Current Task

No task assigned yet. Run intake to get started.
`;

export const MENTOR_SKILLS: Record<string, string> = {
  "mentor-session/SKILL.md": MENTOR_SESSION_SKILL_MD,
  "review/SKILL.md": REVIEW_SKILL_MD,
  "comprehension-check/SKILL.md": COMPREHENSION_CHECK_SKILL_MD,
  "implementation-review/SKILL.md": IMPLEMENTATION_REVIEW_SKILL_MD,
};
