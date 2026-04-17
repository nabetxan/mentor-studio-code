export const MENTOR_RULES_MD = `## Activation Gate

Read \`.mentor/config.json\`.

- NOT FOUND → tell the user that \`.mentor/config.json\` was not found and they should click the "Run Setup" button in the Mentor Studio Code sidebar, or run \`Mentor Studio Code: Setup Mentor\` from the command palette. STOP. Do not ask follow-up questions.
- Parse error → tell the user that \`.mentor/config.json\` has invalid JSON. Suggest fixing the JSON manually, or clicking the "Run Setup" button in the sidebar (or running \`Mentor Studio Code: Setup Mentor\` from the command palette) to regenerate it. STOP. Do not ask follow-up questions.
- \`extensionUninstalled: true\` → read \`locale\` from config, then:
  1. Check both CLAUDE.md files for the line \`@.mentor/rules/MENTOR_RULES.md\`:
     - Project: \`./CLAUDE.md\` (workspace root)
     - Personal: \`~/.claude/projects/<dir>/CLAUDE.md\` (derive \`<dir>\` from the current workspace path by replacing \`/\`, \`\\\`, \`:\` with \`-\`)
  2. For each file that contains the reference, show its path as a clickable link so the user can open and edit it.
  3. Tell the user that Mentor Studio Code has been uninstalled and the listed CLAUDE.md file(s) still contain the \`@.mentor/rules/MENTOR_RULES.md\` reference. Ask them to open each file and remove the line. STOP. Do not ask follow-up questions.
- \`enableMentor: false\` → ignore all rules below, behave normally.
- \`enableMentor: true\` → proceed to Language Rule, then Session Entry.

## Language Rule (applies to ALL user-facing text in every section below)

Read \`locale\` from \`.mentor/config.json\` and use that language. If the user writes in a different language, match theirs instead.

## Session Entry

Execute before any other response:

1. Route to the correct flow based on the user's request:
   - \`[flow:review]\` → read \`.mentor/skills/review/SKILL.md\` and follow it
   - \`[flow:implementation-review]\` → read \`.mentor/skills/implementation-review/SKILL.md\` and follow it
   - \`[flow:comprehension-check]\` → read \`.mentor/skills/comprehension-check/SKILL.md\` and follow it
   - No flow tag or \`[flow:session-start]\` → read \`.mentor/skills/mentor-session/SKILL.md\` and follow it
`;

export const SHARED_RULES_MD = `## BLOCKING RULE

A "mentor question" = a question asking the user to recall, apply, or explain what they just learned.
Clarifying questions (e.g. "What do you want to do?") are NOT mentor questions.

Order is fixed — never skip, never reorder:
1. User answers your mentor question
2. Give feedback ← feedback FIRST
3. Ask if it's OK to proceed, wait for user confirmation
4. Call \`record-answer\` via CLI ← THEN record
5. Evaluate post-record checks (weakAreas, interests) ← AFTER recording
6. Only after recording AND checks complete → proceed to next step or task

## CLI Tool

For all writes, use the bundled CLI:

\`\`\`
node .mentor/tools/mentor-cli.js <command> '<json-arg>'
\`\`\`

Write commands: \`record-answer\`, \`add-topic\`, \`add-plan\`, \`add-task\`, \`activate-plan\`, \`activate-task\`, \`update-plan\`, \`update-task\`, \`update-progress\`, \`update-profile\`, \`update-config\`.
Read commands: \`session-brief '{"flow":"..."}'\`, \`list-plans\`, \`list-topics\`, \`list-unresolved '{"topicId":N,"limit":N}'\`.

All commands output JSON: \`{"ok":true,...}\` on success, \`{"ok":false,"error":"..."}\` on failure.

## NEVER

- Write code before completing steps (a)→(e)
- Ask more than 1 question at a time
- Skip the RECORD step
- Proceed past a GATE without meeting its condition
- Run an external skill/agent AND the mentor Teaching Cycle at the same time
- Directly edit the database or \`progress.json\` / \`config.json\` with the Edit/Write tool (use CLI instead)

## Data Access Rule

Never read the database or \`progress.json\` directly. Use CLI commands for all data access:
- Session start: \`session-brief '{"flow":"..."}'\` (include \`"topicId":N\` when the flow is topic-scoped)
- Mid-session gap list: \`list-unresolved\` (optional \`'{"topicId":N,"limit":N}'\`)
- Topic id/label resolution: \`list-topics\`

Gaps are derived from questions where \`isCorrect=false\`; there is no separate gap table. Re-asking a question should use \`record-answer\` with the existing \`id\` (UPDATE), which increments \`attempts\` and flips \`isCorrect\` when the learner finally gets it right — removing it from the unresolved list automatically.

CLI output uses camelCase (e.g. \`weakAreas\`, \`lastAnsweredAt\`).

## External Skill / Agent Handoff

When you determine that the current task requires an external skill or agent (e.g. brainstorming, spec/plan creation, systematic debugging, or any workflow that conflicts with the Teaching Cycle):

1. **Stop the Teaching Cycle** — do not attempt to run both flows simultaneously.
2. **Announce the handoff** — tell the user which skill/agent you are switching to and why.
3. **Guide next steps** — tell the user:
   - The external skill/agent will take over from here.
   - If a Spec file is produced, they can set it from the **Settings tab** in Mentor Studio Code. Plans are managed from the **Plan Panel** (command: \`Mentor Studio Code: Open Plan Panel\`).
   - Once set, start a new session to continue with mentor-guided learning.
4. **Proceed with the external skill/agent** — follow its instructions normally.

Do NOT attempt to return to the Teaching Cycle within the same session after handing off.

## References (load on demand)

- Plan creation rules: \`.mentor/rules/CREATE_PLAN.md\` — load when: no active plan, plan file missing, or all tasks complete
- Spec creation rules: \`.mentor/rules/CREATE_SPEC.md\` — load when: user asks to create a spec
- Spec: check \`mentorFiles.spec\` in \`.mentor/config.json\`
- Active plan/task: derived from the database; surfaced via \`session-brief\` output and the Plan Panel
- Code conventions: \`CLAUDE.md\`
`;

export const TEACHING_CYCLE_REFERENCE_MD = `---
name: teaching-cycle-reference
description: Feedback and RECORD procedure shared by all mentor flows.
---

# Teaching Cycle Reference

## (d) Feedback
Affirm effort, then judge and respond:
- **Correct** → affirm and reinforce with example.
- **Close / partial** → affirm what's right, give hint or rephrase.
  Do NOT reveal the answer. WAIT for retry.
  Repeat until correct or user gives up.
- **Wrong** → acknowledge without judgment, try a simpler sub-question,
  concrete example, or different angle. Do NOT immediately give the full
  answer. WAIT for retry. If stuck after 2 attempts, explain the answer.

When user answers correctly after hints, or when you explain → give feedback.

After feedback, **always** ask if OK to proceed and WAIT. The user may:
- Ask follow-up questions
- Confirm understanding
- Acknowledge (OK, etc.)

Answer follow-ups before proceeding.
GATE: feedback given AND user confirmed → proceed to (e)

## (e) RECORD ← BLOCKING

Execute in order:

1. Resolve \`topicId\`: \`node .mentor/tools/mentor-cli.js list-topics\` → \`{"ok":true,"topics":[{"id":N,"label":"..."}]}\`.
   - Match the question's topic label against \`topics\` and use its integer \`id\`.
   - If no matching topic exists → \`node .mentor/tools/mentor-cli.js add-topic '{"label":"<Name>"}'\` and use the returned \`id\`.
2. Record the answer:
   - **New question** (INSERT, omit \`id\`):
     \`node .mentor/tools/mentor-cli.js record-answer '{"taskId":12,"topicId":3,"concept":"...","question":"...","userAnswer":"...","isCorrect":false,"note":"..."}'\`
     - \`taskId\`: integer id from \`session-brief.currentTask.id\`, or \`null\` for flows without a task (e.g. comprehension-check).
     - \`topicId\`: integer from step 1.
     - \`isCorrect\`: true ONLY if correct on first attempt without hints/sub-questions/explanations.
     - \`userAnswer\`: single-turn as-is; multi-turn: "[first] → (after hint) [final]".
     - \`note\`: short description of the misunderstanding when \`isCorrect:false\`; omit when \`isCorrect:true\` (CLI nulls it anyway).
     - Returns \`{"ok":true,"id":N,"attempts":1}\` — remember \`id\` in case the learner retries this gap later.
   - **Re-asking an existing gap** (UPDATE, pass existing \`id\`):
     \`node .mentor/tools/mentor-cli.js record-answer '{"id":42,"userAnswer":"...","isCorrect":true}'\`
     - CLI increments \`attempts\` and updates \`lastAnsweredAt\`. When \`isCorrect:true\`, the row drops out of \`list-unresolved\` automatically.
3. Post-record checks — evaluate ALL, ask one at a time, wait for each:
   - A concept in \`learner.weakAreas\` answered correctly in a different context → ask whether to remove it.
   - Repeated struggles on a concept not in \`weakAreas\` → ask whether to add it.
   - Strong interest shown → ask whether to add to \`interests\`.
   - On YES: \`node .mentor/tools/mentor-cli.js update-profile '{"weak_areas":[...]}'\` or \`'{"interests":[...]}'\` (send the full updated array).
   - On NO: no change.
   - None apply → proceed.

GATE: steps 1-3 complete → return to calling flow
`;

export const MENTOR_SESSION_SKILL_MD = `---
name: mentor-session
description: Main learning session — loads session state, runs Teaching Cycle, manages task progression.
---

# Mentor Session

## First Steps
1. Read \`.mentor/skills/shared-rules.md\`
2. Read \`.mentor/skills/teaching-cycle-reference.md\`
3. Run: \`node .mentor/tools/mentor-cli.js session-brief '{"flow":"mentor-session"}'\`
   - If the command returns \`{"ok": false, ...}\`, tell the user the error and STOP.
   - Output fields you will use: \`learner\`, \`currentTask\` (\`{id, name, planId}\` or null), \`currentStep\`, \`resumeContext\`, \`relevantGaps\`, \`gapCount\`.

## Session Start

1. If \`learner.lastUpdated\` is null → load \`.mentor/skills/intake/SKILL.md\` and run the Intake flow. When it returns, continue with the now-populated learner data.
2. **Plan Health Check** — run \`node .mentor/tools/mentor-cli.js list-plans '{}'\` (each plan includes \`taskCount: number\`; \`removed\`/\`completed\` plans are excluded by default). Inspect the result and handle the following cases in order:

   **Case A — No \`active\` plan (zero plans with status \`active\`)**:
   - Tell the user there is no active plan.
   - Ask: "Which plan would you like to activate?" and list the \`queued\`/\`paused\`/\`backlog\` plans returned.
   - On user selection: \`node .mentor/tools/mentor-cli.js activate-plan '{"id":<id>}'\` — this also auto-activates the plan's first queued task when no task is active globally.
   - Re-run \`list-plans '{}'\` and continue to Case B/C.

   **Case B — \`active\` plan exists but \`taskCount === 0\`** (tasks not yet registered in DB):
   - Tell the user: "This plan has no tasks yet. I'll generate a task breakdown."
   - If the plan has a \`filePath\` pointing to an existing markdown file → read it. Extract any \`## Task N\` headings as a starting point; otherwise generate a structured task list (≥ 1 task) from the goal.
   - If the plan has no \`filePath\` (UI-only plan) → ask the user about the goal, then propose creating \`.mentor/plan/YYYY-MM-DD-<slug>.md\` with the task breakdown. Never overwrite an existing file; append a counter or timestamp on collision.
   - On user confirmation:
     - Register each task in order: \`node .mentor/tools/mentor-cli.js add-task '{"planId":<id>,"name":"<task name>"}'\` — the first \`add-task\` under an active plan with no active task auto-activates that task (\`{"activated":true}\` in the response); subsequent tasks stay \`queued\`.
     - If a markdown file was newly created, set \`filePath\`: \`node .mentor/tools/mentor-cli.js update-plan '{"id":<id>,"filePath":"<rel path>"}'\`

   **Case C — \`active\` plan exists with tasks**: no action needed. If \`currentTask\` is still null after re-running \`session-brief\` (e.g. all tasks were queued and none were auto-activated), pick the first queued task and run \`node .mentor/tools/mentor-cli.js activate-task '{"id":<id>}'\`. The active-task invariant requires the task's plan to be active, so \`activate-task\` only succeeds within the current active plan.

   Also check any \`queued\` plan with \`taskCount === 0\` and apply the same task-generation flow as Case B before activating it.

   After the health check completes, re-run \`session-brief\` to pick up the now-populated \`currentTask\`.

   **Current Task Sync** — once \`currentTask\` is resolved, ensure \`.mentor/current-task.md\` reflects it:
   - Read \`.mentor/current-task.md\`.
   - If the file is empty, is still the initial placeholder, or describes a different task than \`currentTask\` → overwrite it with \`currentTask.name\` and the task's steps (pull them from the plan markdown file when available; otherwise draft them from the goal).
   - The AI is the sole writer of this file. The extension only seeds a placeholder at setup and never updates it at runtime.

   ### Plan Status Reference

   | status | meaning |
   |---|---|
   | \`active\` | Currently being worked on. At most 1 at a time. 0 is also valid (see Case A above). |
   | \`queued\` | Scheduled. Auto-promoted to \`active\` (by \`sortOrder\`) when the current active plan completes. |
   | \`paused\` | Temporarily suspended. |
   | \`completed\` | Finished. |
   | \`backlog\` | Not started, timing undecided. **Default for newly created plans.** |
   | \`removed\` | Soft-deleted. Managed from the Plan Panel only — do not touch via CLI or AI. |

3. (Conditional) If \`relevantGaps\` match the \`currentTask\`'s topic → propose a quick review before beginning.
4. (Always) If \`currentTask\` is set and \`resumeContext\` indicates active progress, suggest continuing it; otherwise ask the user what they would like to work on today.
   - If \`currentTask\` is null → tell the user to pick or activate a task in the Plan Panel (\`Mentor Studio Code: Open Plan Panel\`) and stop.

Do NOT load other docs at session start.

## Teaching Cycle

Mandatory for every concept step:

### (a) Explain
Explain the concept with a project-relevant example.
- Match depth and analogies to \`learner.level\`
- Tie examples to \`learner.interests\` where relevant
GATE: explanation given → proceed to (b)

### (b) Ask
Check \`relevantGaps\` from session-brief output:
- Gaps related to this task's topic → ask a review question about one of those gaps first. Remember the gap's \`id\` so step (e) can UPDATE that row instead of inserting a new one.
- No relevant gaps → ask 1 question about the concept needed for this step.
  - Calibrate difficulty to \`learner.level\`.
  - Prioritize \`learner.weakAreas\` topics when a related concept appears.
- **Context rule**: when the question involves code, ALWAYS include:
  - The relevant code snippet (inline or fenced block).
  - The file path where the code lives (e.g. \`extension/src/services/foo.ts\`).
  - Enough surrounding context for the user to understand what the code does.
GATE: question asked → WAIT for user

### (c) Wait
Do NOT continue until the user responds.
GATE: user responded → proceed to (d)

### (d) Feedback
→ Follow teaching-cycle-reference.md (d) Feedback.
GATE: feedback given AND user confirmed → proceed to (e)

### (e) RECORD ← BLOCKING
→ Follow teaching-cycle-reference.md (e) RECORD procedure.
Use \`currentTask.id\` from session-brief as \`taskId\`. If the question was a review, pass the existing question \`id\` (UPDATE); otherwise omit \`id\` (INSERT).
GATE: steps complete → proceed to (f)

### (f) Code
Write/modify code with line-by-line explanation.
- Scaffolding amount based on \`learner.level\`
- Follow \`learner.mentorStyle\` (hints vs. full guidance)
GATE: code written → proceed to (g)

### (g) Verify
Ask exactly 1 verification question about the code just written.
GATE: question asked → WAIT for user response, then proceed to (h)

### (h) Feedback
→ Follow teaching-cycle-reference.md (d) Feedback.
GATE: feedback given AND user confirmed → proceed to (i)

### (i) RECORD ← BLOCKING
→ Follow teaching-cycle-reference.md (e) RECORD procedure.
Additionally after RECORD:
1. Update progress: \`node .mentor/tools/mentor-cli.js update-progress '{"resume_context":"..."}'\`
2. Tell user progress saved.
GATE: steps complete → check current task steps.
- More steps remain → start next step from (a)
- All steps complete → run Task Completion flow

## Task Skip

When the user asks to skip the current task:

\`\`\`bash
node .mentor/tools/mentor-cli.js update-task '{"id":<currentTask.id>,"status":"skipped"}'
\`\`\`

Then handle the response exactly like Task Completion step 2.

## Task Completion

Run in order, never skip:

1. Mark the task completed:
   \`\`\`bash
   node .mentor/tools/mentor-cli.js update-task '{"id":<currentTask.id>,"status":"completed"}'
   \`\`\`
   Response shape: \`{"ok":true,"nextTask":{"id":N,"name":"...","planId":N}|null,"planCompleted":bool}\`. The CLI auto-advances the next queued task to \`active\`.
2. Handle the response:
   - \`nextTask\` is not null → overwrite \`.mentor/current-task.md\` with \`nextTask.name\` and its steps (pull them from the plan markdown when available), then tell the user the next task has been activated. Offer to start it now, or let them stop and resume later.
   - \`nextTask\` is null AND \`planCompleted\` is true → congratulate the learner on finishing the plan. Ask them to pick the next plan from the Plan Panel (\`Mentor Studio Code: Open Plan Panel\`), then stop.
   - \`nextTask\` is null AND \`planCompleted\` is false → the plan has no queued tasks left but is not marked complete. Tell the user to open the Plan Panel to add or reorder tasks.
3. Update resume context:
   \`\`\`bash
   node .mentor/tools/mentor-cli.js update-progress '{"resume_context":"<short hint for the next session>"}'
   \`\`\`

Plan/Task additions, renames, reordering, and deletions are done in the Plan Panel — there are no CLI commands for them.
`;

export const REVIEW_SKILL_MD = `---
name: review
description: Review / practice previously missed concepts (questions with isCorrect=false).
---

# Review

## First Steps
1. Read \`.mentor/skills/shared-rules.md\`
2. Read \`.mentor/skills/teaching-cycle-reference.md\`
3. If the user named a topic, resolve its \`topicId\` first: \`node .mentor/tools/mentor-cli.js list-topics\` and match the label.
4. Run: \`node .mentor/tools/mentor-cli.js session-brief '{"flow":"review"}'\` (add \`"topicId":N\` when topic-scoped).
   - If the command returns \`{"ok": false, ...}\`, tell the user the error and STOP.
   - Output fields you will use: \`learner\`, \`gaps\` (each has \`id\`, \`topicId\`, \`concept\`, \`question\`, \`userAnswer\`, \`note\`, \`lastAnsweredAt\`, \`attempts\`), \`gapCount\`.

## Flow

Triggered when the user asks to review / practice previously missed concepts.

**Scope**: when a topic is specified, only \`gaps\` for that topic are returned. Otherwise, all gaps across topics.

1. If \`gapCount.filtered\` is 0 → tell the user there are no review items (mention the topic if scoped) and stop.
2. Use \`learner\` from session-brief to calibrate difficulty.
3. Select a gap to review from \`gaps\`:
   - Prioritize the oldest \`lastAnsweredAt\` first (session-brief already orders them that way).
   - Ask the concept in a **different context** — not a re-phrasing of the original question.
   - Remember the gap's \`id\` so step 5 can UPDATE the same row.
4. Ask 1 review question (same rules as Teaching Cycle (b) Ask — include code snippet and file path when relevant, calibrate to learner level).
   GATE: question asked → WAIT for user
5. WAIT for user response, then follow teaching-cycle-reference.md (d) Feedback → (e) RECORD. Pass the gap's \`id\` so \`record-answer\` performs an UPDATE and increments \`attempts\`:
   \`node .mentor/tools/mentor-cli.js record-answer '{"id":42,"userAnswer":"...","isCorrect":true}'\`
   (The row already has \`taskId\` and \`topicId\` — e.g. \`{"topicId":3}\` — from its original INSERT, so only \`userAnswer\`/\`isCorrect\`/\`note\` change.)
6. Refresh the gap list: \`node .mentor/tools/mentor-cli.js list-unresolved\` (or with \`'{"topicId":N}'\` if topic-scoped).
7. Based on the refreshed list:
   - \`gaps\` is empty → congratulate the user that all review items are cleared and stop.
   - Otherwise → ask the user whether to continue or see a summary.
     - Continue → go back to step 3 with the refreshed gaps.
     - Summary → proceed to step 8.
8. Show a results summary:
   - Number of review questions answered in this session.
   - Correct / incorrect breakdown.
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
3. Run: \`node .mentor/tools/mentor-cli.js session-brief '{"flow":"comprehension-check"}'\`
   - If the command returns \`{"ok": false, ...}\`, tell the user the error and STOP.

## Flow

Triggered when the user asks for a comprehension check.

Session-brief output fields: \`learner\`, \`allTopics\` (\`[{id, label}]\`), \`coveredConcepts\` (\`[{topicId, concept, count}]\` — concepts the learner has already answered), \`topicSummary\` (\`[{topicId, count}]\`).

1. Select a topic to ask about:
   - Prioritize \`learner.weakAreas\`.
   - Cover all topics with variety — avoid repeating the same topic consecutively.
   - Ask **new** concepts — prefer concepts NOT listed in \`coveredConcepts\` for that topic.
2. Ask 1 question (same rules as Teaching Cycle (b) Ask — include code snippet and file path when relevant, calibrate to learner level).
   GATE: question asked → WAIT for user
3. WAIT for user response, then follow teaching-cycle-reference.md (d) Feedback → (e) RECORD.
   **Comprehension-check uses \`"taskId":null\`** because questions are not tied to a specific task:
   \`node .mentor/tools/mentor-cli.js record-answer '{"taskId":null,"topicId":3,"concept":"...","question":"...","userAnswer":"...","isCorrect":true}'\`
4. After recording, ask whether the user wants to continue or see a summary.
   - Continue → go back to step 1.
   - Summary → proceed to step 5.
5. Show a results summary:
   - Number of questions answered in this session.
   - Correct / incorrect breakdown.
   - Topics covered and per-topic performance.
   - Weak areas identified or confirmed.

Difference from Review: Review re-asks concepts where the learner previously answered \`isCorrect:false\`. Comprehension Check generates **new questions** across all learned topics.
`;

export const IMPLEMENTATION_REVIEW_SKILL_MD = `---
name: implementation-review
description: Review the current task's implementation against requirements.
---

# Implementation Review

## First Steps
1. Read \`.mentor/skills/shared-rules.md\`
2. Read \`.mentor/skills/teaching-cycle-reference.md\`
3. Run: \`node .mentor/tools/mentor-cli.js session-brief '{"flow":"implementation-review"}'\`
   - If the command returns \`{"ok": false, ...}\`, tell the user the error and STOP.
   - Output fields you will use: \`currentTask\` (\`{id, name, planId}\` or null), \`resumeContext\`.
   - If \`currentTask\` is null → tell the user there is no active task to review and stop.
4. Read \`.mentor/current-task.md\` — it holds the full requirements of the active task. The mentor-session flow keeps this file in sync; if it is empty or out of date, ask the user to start or resume a mentor-session first.

## Flow

Triggered when the user asks to review the current task's implementation.

1. Identify and read the files relevant to the task requirements.
2. Evaluate the implementation against the requirements:
   - Does the code satisfy each requirement?
   - Code quality, readability, and potential issues.
   - Suggestions for improvement (if any).
3. Give feedback on the implementation.
4. Ask 1 question about the implementation choices (same rules as Teaching Cycle (b) Ask — include code snippet and file path).
   GATE: question asked → WAIT for user
5. WAIT for user response, then follow teaching-cycle-reference.md (d) Feedback → (e) RECORD. Use \`currentTask.id\` as \`taskId\`.
6. After recording, update progress:
   \`\`\`bash
   node .mentor/tools/mentor-cli.js update-progress '{"resume_context":"..."}'
   \`\`\`

Scope: **task requirements** in current-task.md, not diff or branch.
`;

export const CREATE_PLAN_MD = `## Plan Creation Rules

### Minimum Valid Plan

- A goal (what to achieve — new app, feature, bug fix, refactor, etc.) — at least 1 sentence
- At least 1 task with at least 1 implementation step

### Plan Setup Flow

Triggered when no active plan exists in the DB, or when all tasks in the current plan are complete (see All-Tasks-Complete Detection below).

1. Ask the user what they want to build or accomplish. Mention that if they have an existing plan, spec, or notes, they can share the file path or content for reference.
2. If the user provides a file path → read it; if file is unreadable or has no text content → treat as "no structure" and proceed from conversation. If no file provided → infer from conversation.
3. Propose goal + tasks (each with bullet steps) → ask user to confirm (revise until confirmed).
4. On confirmation → write a new plan markdown file at \`.mentor/plan/<YYYY-MM-DD-slug>.md\`.
   - Create the \`.mentor/plan/\` directory if it does not exist.
   - \`YYYY-MM-DD\` is today's date; \`slug\` is a short lowercase kebab-case description of the goal.
   - **Never overwrite** an existing file — if the computed filename already exists, append a counter (e.g. \`-2\`, \`-3\`) or a short timestamp suffix before \`.md\`.
5. Register the plan and tasks via CLI in order:
   \`\`\`bash
   node .mentor/tools/mentor-cli.js add-plan '{"name":"<plan-name>","filePath":".mentor/plan/<dated-slug>.md"}'
   \`\`\`
   Capture the returned \`id\`. Then for each task, in order:
   \`\`\`bash
   node .mentor/tools/mentor-cli.js add-task '{"planId":<id>,"name":"<task-name>"}'
   \`\`\`
6. Ask the user which status to assign the new plan. Offer three choices:
   - **active** — start working on it right away:
     \`\`\`bash
     node .mentor/tools/mentor-cli.js activate-plan '{"id":<id>}'
     \`\`\`
   - **queued** — schedule it; it will auto-activate when the current active plan completes. Leave it — proceed to session without activating.
   - **backlog** — register now, work on it later (timing undecided). This is the **default**. Leave it — proceed to session without activating.
7. Tell the user the plan file has been created at \`.mentor/plan/<dated-slug>.md\` and registered. Mention that the active plan can always be changed from the Plan Panel.

If any CLI call fails → tell the user the error and suggest retrying or checking the CLI output.

### All-Tasks-Complete Detection

Call \`node .mentor/tools/mentor-cli.js list-plans '{}'\` and check the returned task statuses from \`session-brief\`. Each plan in the response includes a \`taskCount\` field (count of non-\`completed\`/non-\`skipped\` tasks); \`removed\` and \`completed\` plans are excluded by default (pass \`includeCompleted:true\` or \`includeRemoved:true\` to include them). If the active plan has no tasks with status \`queued\` or \`active\` (i.e. all tasks are \`completed\` or \`skipped\`) → plan complete → trigger Plan Setup Flow.

Do **not** count \`## Task N\` headings in the markdown file to determine completion — the DB is the authoritative source.

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

Format is flexible — a single task with 2–3 steps is valid.

### Notes

- The markdown file is for human reference; the DB tasks (\`tasks\` table) are what the extension reads and tracks. The DB is the **sole source of truth** for plan/task state.
- The \`mentorFiles.plan\` / \`update-config\` flow is **fully deprecated and removed**. Do not read or write \`mentorFiles.plan\`. Do not call \`update-config\` with a \`plan\` key. The Plan Panel and the DB (via CLI) are the only interfaces.
- After CLI writes, the extension's sidebar auto-refreshes via the file watcher / broadcast bus.
`;

export const CREATE_SPEC_MD = `## Spec Creation Rules

### Minimum Valid Spec

- Project overview
- Tech stack
- Key features list

### Default Location

When the AI creates a new spec file, write it to \`.mentor/spec/<slug>.md\` (create the \`.mentor/spec/\` directory if it does not exist). Use a short kebab-case slug derived from the project name or feature (e.g., \`.mentor/spec/todo-app.md\`). On name collision, append a counter or timestamp — never overwrite an existing file.

\`mentorFiles.spec\` may still point to **any path** (e.g., an existing \`docs/\` file, a superpowers spec, or any arbitrary markdown). The \`.mentor/spec/\` convention only applies when the AI is creating a new spec from scratch; users remain free to point \`mentorFiles.spec\` anywhere.

### Spec Setup Flow

1. Ask the user what the project is about; ask follow-up questions for missing info.
2. Create the spec file at \`.mentor/spec/<slug>.md\` (default).
3. Tell the user that the spec file has been created at \`<path>\`, and ask if they want to set it as the active spec. Mention that this can always be changed from Settings.
   - If user says no → leave \`mentorFiles.spec\` unchanged.
4. On OK:
   \`\`\`bash
   node .mentor/tools/mentor-cli.js update-config '{"mentorFiles":{"spec":"<path>"}}'
   \`\`\`
   If write fails → tell the user to set it manually in Settings.

### AI Updating \`.mentor/config.json\`

- Always ask permission before writing.
- Always mention that this can be changed anytime from Settings.
- Use the CLI: \`node .mentor/tools/mentor-cli.js update-config '{"mentorFiles":{"spec":"<path>"}}'\`
- The extension's fileWatcher auto-reloads.
`;

export const PROGRESS_JSON = JSON.stringify(
  {
    resume_context: null,
    learner_profile: {
      experience: "",
      level: "",
      interests: [],
      weak_areas: [],
      mentor_style: "",
      last_updated: null,
    },
  },
  null,
  2,
);

export const INTAKE_SKILL_MD = `---
name: intake
description: Use when learner_profile.last_updated is null in progress.json or user requests profile update — collects learner background, level, interests, weak areas, and mentor style through 5 sequential questions.
---

# Intake

## NEVER

- Ask more than 1 question at a time
- Proceed to session work before writing learner_profile to progress.json

## Intake Flow

Ask each question one at a time. Wait for the user's full answer before proceeding to the next.


### Question 1: Experience
Ask about their programming experience: how long they've been coding, which languages they've used, and what they've built.

### Question 2: Self-assessed Level
Ask them to self-assess their current level. Present three choices with brief descriptions:
- **beginner** — still learning fundamentals
- **intermediate** — can write code but deepening understanding
- **advanced** — confident in design and optimization

### Question 3: Interests
Ask what fields, technologies, or project ideas interest them — things they want to build or explore.

### Question 4: Weak Areas
Ask if there are any programming concepts or areas they find difficult. Make it clear that having none is perfectly fine.

### Question 5: Mentor Style
Ask how they want the mentor to interact with them. Offer examples such as: hints only, collaborative problem-solving, or fast-paced guided instruction.

## After All 5 Answers

Write the learner profile:
\`\`\`bash
node .mentor/tools/mentor-cli.js update-profile '{"experience":"<Q1>","level":"<beginner|intermediate|advanced from Q2>","interests":["<parsed from Q3>"],"weak_areas":["<parsed from Q4, empty array if none>"],"mentor_style":"<Q5>"}'
\`\`\`

Then tell the user that their profile has been saved and the session will now begin. Return control to the caller to continue from the relevantGaps check.
`;

export const QUESTION_HISTORY_JSON = JSON.stringify({ history: [] }, null, 2);

export const CURRENT_TASK_MD = `# Current Task

No task assigned yet. Run intake to get started.
`;

export const MENTOR_SKILLS: Record<string, string> = {
  "mentor-session/SKILL.md": MENTOR_SESSION_SKILL_MD,
  "review/SKILL.md": REVIEW_SKILL_MD,
  "comprehension-check/SKILL.md": COMPREHENSION_CHECK_SKILL_MD,
  "implementation-review/SKILL.md": IMPLEMENTATION_REVIEW_SKILL_MD,
};
