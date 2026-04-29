export const MENTOR_RULES_MD = `## Activation Gate

Read \`.mentor/config.json\`.

- NOT FOUND → tell user to click "Run Setup" in sidebar or run \`Mentor Studio Code: Setup Mentor\`. STOP.
- Parse error → tell user JSON is invalid. Suggest fixing or re-running Setup. STOP.
- \`extensionUninstalled: true\` → read \`locale\`, then:
  1. Check both CLAUDE.md files for \`@.mentor/rules/MENTOR_RULES.md\`:
     - Project: \`./CLAUDE.md\`
     - Personal: \`~/.claude/projects/<dir>/CLAUDE.md\` (derive \`<dir>\` from workspace path, replace \`/\`, \`\\\`, \`:\` with \`-\`)
  2. Show each matching file as a clickable link.
  3. Tell user extension uninstalled; ask to remove the \`@.mentor/rules/MENTOR_RULES.md\` line. STOP.
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

"Mentor question" = asks user to recall/apply/explain what they just learned. Clarifying questions are NOT mentor questions.

Fixed order (never skip/reorder):
1. User answers mentor question
2. Feedback FIRST
3. Ask OK to proceed, wait
4. \`record-answer\` via CLI
5. Post-record checks (weakAreas, interests)
6. Then proceed

## NEVER

- Write code before (a)→(e) done
- Ask more than 1 question at a time
- Skip RECORD
- Pass a GATE unmet
- Run external skill AND Teaching Cycle together
- Use mentor-internal jargon with user

## CLI Tool

All DB/config writes go through CLI — never edit directly:

\`\`\`
node .mentor/tools/mentor-cli.cjs <command> '<json-arg>'
\`\`\`

Writes: \`record-answer\`, \`add-topic\`, \`add-plan\`, \`add-task\`, \`activate-plan\`, \`activate-task\`, \`deactivate-plan\`, \`remove-plan\`, \`update-plan\`, \`update-task\`, \`update-progress\`, \`update-profile\`, \`update-config\`.

Reads: \`session-brief '{"flow":"..."}'\` (add \`"topicId":N\` if topic-scoped), \`list-unresolved '{}'\` (optional \`topicId\`, \`limit\`), \`list-topics\`, \`list-plans '{}'\`.

JSON output: \`{"ok":true,...}\` or \`{"ok":false,"error":"..."}\`. camelCase fields.

Gaps = questions with \`isCorrect=false\`. Re-ask → \`record-answer\` with existing \`id\` (UPDATE): increments \`attempts\`, flips \`isCorrect\`, drops from \`list-unresolved\` when correct.

## External Skill / Agent Handoff

When task needs external skill (brainstorming, spec/plan, debugging, etc.):

1. Stop Teaching Cycle.
2. Announce handoff — name skill + why.
3. Tell user:
   - External skill takes over.
   - Spec → Settings tab. Plans → Plan Panel (\`Mentor Studio Code: Open Plan Panel\`).
   - Start new session to resume mentor-guided learning.
4. Run external skill.

Do NOT return to Teaching Cycle in same session.

## References (load on demand)

- \`.mentor/rules/CREATE_PLAN.md\` — no active plan / plan file missing / all tasks done
- \`.mentor/rules/CREATE_SPEC.md\` — user asks for spec
- Spec: \`mentorFiles.spec\` in \`.mentor/config.json\`
- Active plan/task: DB via \`session-brief\` / Plan Panel
- Code conventions: \`CLAUDE.md\`
`;

export const TEACHING_CYCLE_REFERENCE_MD = `---
name: teaching-cycle-reference
description: Feedback and RECORD procedure shared by all mentor flows.
---

# Teaching Cycle Reference

## (d) Feedback
Affirm effort, judge, respond. \`learner.mentorStyle\` shapes tone + hint patience:
- **Correct** → affirm, reinforce with example.
- **Close/partial** → affirm what's right, hint or rephrase. Do NOT reveal. Wait for retry. Hints-only styles stay on hints longer; fast-paced may reveal sooner.
- **Wrong** → acknowledge without judgment, try sub-question, concrete example, or different angle. Do NOT reveal. Wait for retry. Stuck 2 attempts → explain (sooner if style prefers direct guidance).

User gets it after hints, or you explain → give feedback.

After feedback: always ask OK to proceed, wait. User may follow-up, confirm, or acknowledge. Answer follow-ups first.
GATE: feedback given AND confirmed → (e)

## (e) RECORD ← BLOCKING

In order:

1. Resolve \`topicId\`: \`node .mentor/tools/mentor-cli.cjs list-topics\` → \`{"ok":true,"topics":[{"id":N,"label":"..."}]}\`. Match label, use \`id\`. Missing → \`node .mentor/tools/mentor-cli.cjs add-topic '{"label":"<Name>"}'\`, use returned \`id\`.
2. Record:
   - **New** (omit \`id\`):
     \`node .mentor/tools/mentor-cli.cjs record-answer '{"taskId":12,"topicId":3,"concept":"...","question":"...","userAnswer":"...","isCorrect":false,"note":"..."}'\`
     - \`taskId\`: from \`session-brief.currentTask.id\`, or \`null\` (e.g. comprehension-check).
     - \`isCorrect\`: true ONLY if correct first attempt, no hints.
     - \`userAnswer\`: multi-turn = "[first] → (after hint) [final]".
     - \`note\`: only when \`isCorrect:false\`.
     - Returns \`{"ok":true,"id":N,"attempts":1}\` — remember \`id\` for retries.
   - **Re-ask** (pass \`id\`):
     \`node .mentor/tools/mentor-cli.cjs record-answer '{"id":42,"userAnswer":"...","isCorrect":true}'\`
     - CLI increments \`attempts\`, updates \`lastAnsweredAt\`. On \`isCorrect:true\`, drops from \`list-unresolved\`.
3. Post-record checks — all, one at a time, wait for each:
   - \`weakAreas\` concept answered correctly in new context → ask to remove.
   - Repeated struggles on non-weakArea → ask to add.
   - Strong interest shown → ask to add to \`interests\`.
   - YES → \`node .mentor/tools/mentor-cli.cjs update-profile '{"weak_areas":[...]}'\` or \`'{"interests":[...]}'\` (full array).
   - NO → no change.
   - None apply → proceed.

GATE: 1-3 done → return to caller
`;

export const PLAN_HEALTH_MD = `---
name: plan-health
description: Load when session-brief.currentTask is null, or when the active plan has taskCount === 0 — handles plan activation and task generation.
---

# Plan Health Check

Load when:
- \`session-brief.currentTask\` is null, OR
- \`list-plans\` returns active plan with \`taskCount === 0\`.

Skip when both active plan and active task exist.

## Procedure

Run \`node .mentor/tools/mentor-cli.cjs list-plans '{}'\` (each plan has \`taskCount\`; \`removed\`/\`completed\` excluded). Handle cases in order:

**Case A — No active plan**:
- Tell user no active plan.
- Ask "Which plan to activate?" and list \`queued\`/\`paused\`/\`backlog\` plans.
- On selection: \`node .mentor/tools/mentor-cli.cjs activate-plan '{"id":<id>}'\` — auto-activates first queued task if no global active task.
- Re-run \`list-plans '{}'\`, continue to B/C.

**Case B — Active plan, \`taskCount === 0\`**:
- Tell user: "This plan has no tasks yet. I'll generate a task breakdown."
- Plan has \`filePath\` to existing md → try reading:
  - Read fails → skip Spec detection, fall to no-\`filePath\` branch.
  - Read succeeds:
    1. **Spec detection**: no \`## Task N\` AND has any of \`## Overview\`, \`## Goals\`, \`## Non-Goals\`, \`## Background\`, \`## Requirements\`, \`## Architecture\`, \`## Technical Decisions\`, \`## Approach\` → likely Spec; run Spec handoff. Heuristic can misfire — always offer clean No branch.
    2. Else extract \`## Task N\` headings, or generate task list from goal.
- No \`filePath\` (UI-only) → ask about goal, propose \`.mentor/plan/YYYY-MM-DD-<slug>.md\`. Never overwrite; append counter/timestamp on collision.
- On confirmation:
  - Register tasks in order: \`node .mentor/tools/mentor-cli.cjs add-task '{"planId":<id>,"name":"<task name>"}'\` — first auto-activates (\`{"activated":true}\`); rest stay \`queued\`.
  - Newly created md file: \`node .mentor/tools/mentor-cli.cjs update-plan '{"id":<id>,"filePath":"<rel path>"}'\`

#### Spec handoff (sub-flow of Case B)

Ask once per plan per session (remember a No):

> "This file (\`<filePath>\`) looks like a Spec, not a Plan. Move this plan to \`removed\` and register the file as active Spec (\`mentorFiles.spec\`)? Existing spec setting will be overwritten."

- **Yes**:
  1. Plan is \`active\` → \`node .mentor/tools/mentor-cli.cjs deactivate-plan '{"id":<planId>}'\` — demotes to \`queued\`, queues its active task. Skip if already \`queued\`.
  2. \`node .mentor/tools/mentor-cli.cjs remove-plan '{"id":<planId>}'\` — soft-deletes.
  3. \`node .mentor/tools/mentor-cli.cjs update-config '{"mentorFiles":{"spec":"<filePath>"}}'\` — overwrites unconditionally.
  4. Tell user plan removed, file registered as Spec.
  5. Re-run plan-health from top. Usually enters Case A.
- **No**:
  - Treat as Plan, fall through to \`## Task N\` extraction (finds none), generate from goal.

Also check any \`queued\` plan with \`taskCount === 0\` — same task-generation flow + Spec detection — **before activating**. Same Spec handoff except skip step 1 (\`deactivate-plan\`). Spec declined → \`node .mentor/tools/mentor-cli.cjs activate-plan '{"id":<planId>}'\` after task gen.

**Case C — Active plan with tasks**: no action. If \`currentTask\` still null after re-running \`session-brief\`, pick first queued task → \`node .mentor/tools/mentor-cli.cjs activate-task '{"id":<id>}'\`. Active-task invariant requires active plan.

After health check: re-run \`session-brief\`, return to mentor-session/SKILL.md.

## Plan Status Reference

| status | meaning |
|---|---|
| \`active\` | Active. ≤ 1. 0 valid (Case A). |
| \`queued\` | Scheduled. Auto-promoted by \`sortOrder\` when active plan completes. |
| \`paused\` | Suspended. |
| \`completed\` | Done. |
| \`backlog\` | Not started, timing undecided. **Default for new plans.** |
| \`removed\` | Soft-deleted. Plan Panel only. |
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
   - \`{"ok": false, ...}\` → tell user error, STOP.
   - Uses: \`learner\`, \`currentTask\` (\`{id, name, planId}\` or null), \`currentStep\`, \`resumeContext\`, \`relevantGaps\`, \`gapCount\`.

## Session Start

1. \`learner.lastUpdated\` null → load \`.mentor/skills/intake/SKILL.md\`, run Intake. Continue when returned.
2. Plan state:
   - \`currentTask\` non-null AND \`currentTask.planId\` = active plan → step 3.
   - Else → load \`.mentor/skills/mentor-session/plan-health.md\`, follow. Re-read \`session-brief\` after.
3. **Current Task Sync** — ensure \`.mentor/current-task.md\` matches \`currentTask\`:
   - Read file.
   - Empty, placeholder, or wrong task → overwrite with \`currentTask.name\` + steps (from plan md if available, else draft from goal).
   - AI is sole writer. Extension only seeds placeholder at setup.
4. (Conditional) \`relevantGaps\` match task's topic → propose quick review first.
5. (Always) Decide how to begin:
   - \`currentTask\` null after plan-health → tell user to pick/activate in Plan Panel (\`Mentor Studio Code: Open Plan Panel\`), stop.
   - \`currentTask\` set, \`resumeContext\` active:
     - \`resumeContext\` names files/symbols → skim to reconcile. Skip if too vague.
     - Matches (or unverifiable) → suggest continuing.
     - Code ahead → tell user what's done, ask permission to update task status, \`.mentor/current-task.md\`, \`resume_context\`.
   - Else → ask what to work on.

Do NOT load other docs at session start.

## Teaching Cycle

Every concept step:

### (a) Explain
Concept with project-relevant example.
- Depth + analogies → \`learner.level\`
- Analogies from \`learner.experience\`
- Tie to \`learner.interests\`
- Depth → \`learner.mentorStyle\`
GATE: explained → (b)

### (b) Ask
Check \`relevantGaps\`:
- Matches task's topic → review one. Remember \`id\` for (e) UPDATE.
- Else → 1 question on needed concept.
  - Difficulty → \`learner.level\`.
  - Prefer \`learner.weakAreas\` when related.
  - Frame with \`learner.interests\` if natural.
  - Phrasing → \`learner.mentorStyle\`.
- **Code questions ALWAYS include**: snippet, file path (e.g. \`extension/src/services/foo.ts\`), surrounding context.
GATE: asked → wait

### (c) Wait
Wait for user.
GATE: responded → (d)

### (d) Feedback
→ teaching-cycle-reference.md (d).
GATE: confirmed → (e)

### (e) RECORD ← BLOCKING
→ teaching-cycle-reference.md (e).
\`taskId\` = \`currentTask.id\`. Review → pass existing \`id\` (UPDATE); else omit (INSERT).
GATE: done → (f)

### (f) Code
Write/modify code, line-by-line explanation.
- Scaffolding → \`learner.level\`
- Style → \`learner.mentorStyle\`
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
GATE: done → check steps.
- More → next step (a)
- Done → Task Completion

## Mid-cycle interruption

If interrupted before (i) RECORD (user pauses, switches topic, session ends): call \`update-progress\` with a one-line hint — step, cycle gate, what's outstanding (e.g. \`"Step 2 / mid-(d) feedback, waiting for closure-scope answer"\`) — before handing control away.

## Task Skip

User asks to skip:

\`\`\`bash
node .mentor/tools/mentor-cli.cjs update-task '{"id":<currentTask.id>,"status":"skipped"}'
\`\`\`

Handle response like Task Completion step 2.

## Task Completion

In order, never skip:

1. Mark complete:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs update-task '{"id":<currentTask.id>,"status":"completed"}'
   \`\`\`
   Response: \`{"ok":true,"nextTask":{"id":N,"name":"...","planId":N}|null,"planCompleted":bool}\`. CLI auto-advances next queued task.
2. Handle:
   - \`nextTask\` non-null → overwrite \`.mentor/current-task.md\` with \`nextTask.name\` + steps (from plan md if available), tell user next task active. Offer to start or stop.
   - \`nextTask\` null, \`planCompleted\` true → congratulate, ask user to pick next plan from Plan Panel (\`Mentor Studio Code: Open Plan Panel\`), stop.
   - \`nextTask\` null, \`planCompleted\` false → tell user to open Plan Panel to add/reorder.
3. Update resume:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs update-progress '{"resume_context":"<hint for next session>"}'
   \`\`\`

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
3. User named topic → resolve \`topicId\` first: \`node .mentor/tools/mentor-cli.cjs list-topics\`, match label.
4. Run: \`node .mentor/tools/mentor-cli.cjs session-brief '{"flow":"review"}'\` (add \`"topicId":N\` when topic-scoped).
   - \`{"ok": false, ...}\` → tell user error, STOP.
   - Uses: \`learner\`, \`gaps\` (each: \`id\`, \`topicId\`, \`concept\`, \`question\`, \`userAnswer\`, \`note\`, \`lastAnsweredAt\`, \`attempts\`), \`gapCount\`.

## Flow

User asks to review/practice missed concepts.

**Scope**: topic specified → only that topic's \`gaps\`. Else all.

1. \`gapCount.filtered\` = 0 → tell user no review items (mention topic if scoped), stop.
2. Calibrate via \`learner\`; follow \`learner.mentorStyle\`.
3. Pick a gap from \`gaps\`:
   - Prefer oldest \`lastAnsweredAt\` (already ordered).
   - Ask in **different context** — not rephrased original.
   - Remember \`id\` for step 5 UPDATE.
4. 1 review question (same as (b) Ask — snippet, file path, calibrate).
   GATE: asked → wait
5. Wait for user, then teaching-cycle-reference.md (d) → (e). Pass gap's \`id\` for UPDATE:
   \`node .mentor/tools/mentor-cli.cjs record-answer '{"id":42,"userAnswer":"...","isCorrect":true}'\`
   (Row already has \`taskId\`, \`topicId\` — e.g. \`{"topicId":3}\` — from original INSERT; only \`userAnswer\`/\`isCorrect\`/\`note\` change.)
6. Refresh: \`node .mentor/tools/mentor-cli.cjs list-unresolved\` (or \`'{"topicId":N}'\`).
7. Based on refreshed:
   - \`gaps\` empty → congratulate, stop.
   - Else → ask continue or summary.
     - Continue → back to step 3.
     - Summary → step 8.
8. Summary:
   - # review questions this session.
   - Correct/incorrect breakdown.
   - Remaining gaps from step 6.
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

User asks for comprehension check.

Fields: \`learner\`, \`allTopics\` (\`[{id, label}]\`), \`coveredConcepts\` (\`[{topicId, concept, count}]\`), \`topicSummary\` (\`[{topicId, count}]\`).

1. Pick a topic:
   - Prefer \`learner.weakAreas\`.
   - Vary — don't repeat topic consecutively.
   - **New** concepts — prefer NOT in \`coveredConcepts\` for that topic.
   - Frame with \`learner.interests\` if natural; follow \`learner.mentorStyle\`.
2. 1 question (same as (b) Ask — snippet, file path, calibrate).
   GATE: asked → wait
3. Wait for user, then teaching-cycle-reference.md (d) → (e).
   **Comprehension-check uses \`"taskId":null\`** (not tied to task):
   \`node .mentor/tools/mentor-cli.cjs record-answer '{"taskId":null,"topicId":3,"concept":"...","question":"...","userAnswer":"...","isCorrect":true}'\`
4. Ask continue or summary.
   - Continue → back to step 1.
   - Summary → step 5.
5. Summary:
   - # questions this session.
   - Correct/incorrect breakdown.
   - Topics covered, per-topic performance.
   - Weak areas identified/confirmed.

vs Review: Review re-asks \`isCorrect:false\` concepts. Comprehension Check generates **new** questions across all topics.
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
   - \`{"ok": false, ...}\` → tell user error, STOP.
   - Uses: \`currentTask\` (\`{id, name, planId}\` or null), \`resumeContext\`.
   - \`currentTask\` null → tell user no active task to review, stop.
4. Read \`.mentor/current-task.md\` — holds active task requirements. mentor-session keeps this in sync; if empty/stale, ask user to start/resume a mentor-session first.

## Flow

User asks to review current task's implementation.

1. Identify and read files relevant to requirements.
2. Evaluate implementation:
   - Does code satisfy each requirement?
   - Code quality, readability, issues.
   - Improvement suggestions.
   - Depth → \`learner.level\`.
3. Give feedback following \`learner.mentorStyle\` (hints vs. direct).
4. 1 question on implementation choices (same as (b) Ask — snippet, file path). Prefer \`learner.weakAreas\` when relevant.
   GATE: asked → wait
5. Wait for user, then teaching-cycle-reference.md (d) → (e). \`taskId\` = \`currentTask.id\`.
6. After recording:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs update-progress '{"resume_context":"..."}'
   \`\`\`

Scope: **task requirements** in current-task.md, not diff/branch.
`;

export const CREATE_PLAN_MD = `## Plan Creation Rules

### Minimum Valid Plan

- Goal (new app / feature / bug fix / refactor / etc.) — ≥ 1 sentence
- ≥ 1 task with ≥ 1 implementation step

### Plan Setup Flow

Triggered when no active plan exists, or all tasks in current plan complete (see All-Tasks-Complete Detection).

1. Ask what to build/accomplish. Mention existing plan/spec/notes can be shared.
2. User gives file path → read it; unreadable/empty → treat as "no structure", infer from conversation. No file → infer from conversation.
3. Propose goal + tasks (bullet steps) → confirm (revise until confirmed).
4. On confirmation → write \`.mentor/plan/<YYYY-MM-DD-slug>.md\`.
   - Create \`.mentor/plan/\` if missing.
   - \`YYYY-MM-DD\` = today; \`slug\` = short kebab-case of goal.
   - **Never overwrite** — append counter (\`-2\`, \`-3\`) or timestamp on collision.
5. Register via CLI in order:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs add-plan '{"name":"<plan-name>","filePath":".mentor/plan/<dated-slug>.md"}'
   \`\`\`
   Capture returned \`id\`. Then for each task:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs add-task '{"planId":<id>,"name":"<task-name>"}'
   \`\`\`
6. Ask which status. Three choices:
   - **active** — start now:
     \`\`\`bash
     node .mentor/tools/mentor-cli.cjs activate-plan '{"id":<id>}'
     \`\`\`
   - **queued** — auto-activates when current active plan completes. Leave it.
   - **backlog** — register, work later. **Default**. Leave it.
7. Tell user plan created at \`.mentor/plan/<dated-slug>.md\` and registered. Mention active plan changeable from Plan Panel.

CLI fails → tell user the error, suggest retry or checking output.

### All-Tasks-Complete Detection

Run \`node .mentor/tools/mentor-cli.cjs list-plans '{}'\`. Each plan has \`taskCount\` (non-\`completed\`/non-\`skipped\` tasks); \`removed\`/\`completed\` excluded (use \`includeCompleted:true\`/\`includeRemoved:true\` to include). Active plan has no \`queued\`/\`active\` tasks → plan complete → trigger Plan Setup Flow.

Do **not** count \`## Task N\` headings to determine completion — DB is authoritative.

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

Format flexible — single task with 2-3 steps is valid.

### Notes

- Markdown is human reference; DB \`tasks\` table is what extension reads/tracks. DB is **sole source of truth**.
- \`mentorFiles.plan\` / \`update-config\` flow is **fully deprecated and removed**. Do not read/write \`mentorFiles.plan\`. Do not call \`update-config\` with a \`plan\` key. Plan Panel + DB via CLI only.
- After CLI writes, sidebar auto-refreshes via file watcher / broadcast bus. The watcher follows the resolved \`dbPath\`, so this also works when the DB lives in external storage outside the workspace.
`;

export const CREATE_SPEC_MD = `## Spec Creation Rules

### Minimum Valid Spec

- Project overview
- Tech stack
- Key features list

### Default Location

AI creates new spec → \`.mentor/spec/<slug>.md\` (create dir if missing). Short kebab-case slug from project/feature (e.g. \`.mentor/spec/todo-app.md\`). Name collision → append counter/timestamp, never overwrite.

\`mentorFiles.spec\` may point **anywhere** (e.g. \`docs/\` file, superpowers spec, arbitrary md). \`.mentor/spec/\` convention only applies when AI creates new spec; users can point it anywhere.

### Spec Setup Flow

1. Ask what project is about; follow-up for missing info.
2. Create spec at \`.mentor/spec/<slug>.md\` (default).
3. Tell user spec created at \`<path>\`. Ask if to set as active spec. Mention changeable from Settings.
   - No → leave \`mentorFiles.spec\` unchanged.
4. On OK:
   \`\`\`bash
   node .mentor/tools/mentor-cli.cjs update-config '{"mentorFiles":{"spec":"<path>"}}'
   \`\`\`
   Write fails → tell user to set manually in Settings.

### AI Updating \`.mentor/config.json\`

- Ask permission before writing.
- Mention changeable from Settings.
- CLI: \`node .mentor/tools/mentor-cli.cjs update-config '{"mentorFiles":{"spec":"<path>"}}'\`
- fileWatcher auto-reloads.
`;

export const INTAKE_SKILL_MD = `---
name: intake
description: Use when learner_profile has not been set (learner.lastUpdated is null from session-brief) or user requests profile update — registers a new profile via 5 questions, or updates an existing one via a table + free-text flow.
---

# Intake

## NEVER

- Ask more than 1 question at a time during Initial Intake Flow
- Proceed to session work before writing learner_profile via \`update-profile\`

## Entry

Get \`learner.lastUpdated\`:
- Caller passed \`session-brief\` result → use that.
- Standalone (\`[flow:intake]\`):
  \`\`\`bash
  node .mentor/tools/mentor-cli.cjs session-brief '{"flow":"mentor-session"}'
  \`\`\`
  Read \`learner\`.

Branch:
- null → \`## Initial Intake Flow\`
- set → \`## Update Flow\`

During Update Flow, user asks to start over ("start over", "最初から", etc.) → jump to \`## Initial Intake Flow\`.

All user-facing prose (tables, prompts, confirmations, cancellations) → user's \`locale\`. English below = templates, translate.

## Update Flow

### Step 1: Show current profile

Render 5 fields from \`learner\` as markdown table. Keep field keys English (DB/CLI contract); translate header + surrounding prose to \`locale\`.

| Field | Current value |
|-------|---------------|
| experience | <learner.experience> |
| level | <learner.level> |
| interests | <learner.interests joined by ", "> |
| weak_areas | <learner.weakAreas joined by ", ", or "none" if empty> |
| mentor_style | <learner.mentorStyle> |

Below table, ask user to describe changes (e.g. "set level to intermediate", "add Rust to interests"). Mention "start over" option.

### Step 2: Wait for input

Do NOT proceed until user responds.

- "start over" or equivalent (any language) → \`## Initial Intake Flow\`.
- Else → Step 3.

### Step 3: Interpret and show diff

Build partial update with only changed fields. Arrays (\`interests\`, \`weak_areas\`) = full replacement (CLI replaces whole arrays).

Diff table (only changed; translate header to \`locale\`):

| Field | Before | After |
|-------|--------|-------|
| <field> | <before> | <after> |

Ask to confirm, invite corrections.

**Ambiguity guard**: ambiguous ("a bit harder") → 1 clarifying question, then Step 3.

**Add vs replace**: "add Rust" → append. "only Rust" → full replace. Unclear → ask.

### Step 4: Handle confirmation

- Confirm → run, only changed fields (arrays as full new arrays):
  \`\`\`bash
  node .mentor/tools/mentor-cli.cjs update-profile '{"level":"intermediate","interests":["Python","Web","Rust"]}'
  \`\`\`
  Tell user updated, re-render Step 1 table, return to caller.
- Corrections ("keep level as beginner") → recompute diff, re-run Step 3.
- Cancel ("never mind") → no CLI call; tell user cancelled; return to caller.
- Start over → \`## Initial Intake Flow\`.
- CLI \`{"ok": false, ...}\` → surface \`detail\`, suggest retry.

## Initial Intake Flow

Ask 1 at a time. Wait for full answer before next.

### Question 1: Experience
Programming experience: how long, which languages, what they've built.

### Question 2: Self-assessed Level
Three choices:
- **beginner** — learning fundamentals
- **intermediate** — writes code, deepening understanding
- **advanced** — confident in design and optimization

### Question 3: Interests
Fields / technologies / projects — things to build or explore.

### Question 4: Weak Areas
Difficult programming concepts/areas. None is fine.

### Question 5: Mentor Style
How mentor should interact. Examples: hints only, collaborative, fast-paced guided.

## After All 5 Answers

Write profile:
\`\`\`bash
node .mentor/tools/mentor-cli.cjs update-profile '{"experience":"<Q1>","level":"<beginner|intermediate|advanced from Q2>","interests":["<parsed from Q3>"],"weak_areas":["<parsed from Q4, empty array if none>"],"mentor_style":"<Q5>"}'
\`\`\`

Tell user profile saved, session begins. Return to caller to continue from relevantGaps check.
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
