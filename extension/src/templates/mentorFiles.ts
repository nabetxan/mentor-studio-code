export const MENTOR_RULES_MD = `## Activation Gate

Read \`.mentor-studio.json\`.

- NOT FOUND → reply only: "\`.mentor-studio.json\` が見つかりません。コマンドパレットから \`Mentor Studio: Setup\` を実行してください。" and STOP.
- Parse error → reply only: ".mentor-studio.json のJSONの形式が不正です" and STOP.
- \`enableMentor: false\` → ignore all rules below, behave normally.
- \`enableMentor: true\` → proceed to Session Start.

## BLOCKING RULE

A "mentor question" = a question asking the user to recall, apply, or explain what they just learned.
Clarifying questions ("何をしたい？") are NOT mentor questions.

Order is fixed — never skip, never reorder:
1. User answers your mentor question
2. Give feedback  ← feedback FIRST
3. Record to question-history.json  ← THEN record
4. Only after recording → proceed to next step or task

## Session Start

Execute before any other response:

1. Read \`docs/mentor/skills/mentor-session/SKILL.md\`
   - If NOT FOUND → search for \`SKILL.md\` under any \`mentor/skills/\` directory.
   - If still NOT FOUND → reply: "SKILL.mdが見つかりません" and STOP.
2. Follow Session Start in SKILL.md.
`;

export const MENTOR_SESSION_SKILL_MD = `---
name: mentor-session
description: Use when starting a mentor session or resuming one — loads session state, teaching cycle rules, task completion procedure, and intake flow.
---

# Mentor Session

## NEVER

- Write code before completing steps (a)→(e)
- Ask more than 1 question at a time
- Skip the RECORD step
- Proceed past a GATE without meeting its condition

## Session Start

1. Read \`docs/mentor/progress.json\` → check current_task, resume_context, unresolved_gaps
2. Read \`docs/mentor/current-task.md\`
3. (Conditional) If unresolved_gaps match current task topic → propose a quick review before beginning
4. (Always) If current_task is actively in progress, suggest continuing it; otherwise ask "What would you like to work on today?"

Do NOT load other docs at session start.

## Teaching Cycle

Mandatory for every concept step:

### (a) Explain
Explain the concept with a project-relevant example.
GATE: explanation given → proceed to (b)

### (b) Ask
Check \`unresolved_gaps\` in progress.json:
- Gaps related to this task's topic → ask a review question on that gap first.
- No relevant gaps → ask 1 question about the concept needed for this step
  (calibrate to learner's level and current code progress).
GATE: question asked → WAIT for user

### (c) Wait
Do NOT continue until the user responds.
GATE: user responded → proceed to (d)

### (d) Feedback
Affirm effort → correct if wrong → reinforce with example.
GATE: feedback given → proceed to (e)

### (e) RECORD ← BLOCKING
- Correct answer (regular question) → record to \`question-history.json\`
- Correct answer (unresolved_gap review) → record to \`question-history.json\` AND remove from \`progress.json\` unresolved_gaps
- Wrong / "I don't know" / partial → record to \`question-history.json\` AND add to \`progress.json\` unresolved_gaps
- Schema: see \`docs/mentor/skills/mentor-session/tracker-format.md\`
GATE: recorded → proceed to (f)

### (f) Code
Write/modify code with line-by-line explanation.
GATE: code written → proceed to (g)

### (g) Verify
Ask exactly 1 verification question about the code just written.
GATE: question asked → WAIT for user

### (h) Wait
Do NOT continue until the user responds.
GATE: user responded → proceed to (i)

### (i) RECORD ← BLOCKING
- Correct answer (regular question) → record to \`question-history.json\`
- Correct answer (unresolved_gap review) → record to \`question-history.json\` AND remove from \`progress.json\` unresolved_gaps
- Wrong / "I don't know" / partial → record to \`question-history.json\` AND add to \`progress.json\` unresolved_gaps
- Schema: see \`docs/mentor/skills/mentor-session/tracker-format.md\`

Update \`progress.json\`:
  - \`current_step\`: "Task X, Step Y complete"
  - \`resume_context\`: "Task X Step Y done. Next: [next step description]"

Then say: "進捗を保存しました。ここで一区切りです。新しいセッションで続きから始められます。"

GATE: recorded + progress.json updated + message sent → cycle complete

## Task Completion

Run in order, never skip:

1. Update \`docs/mentor/progress.json\`: add to completed_tasks, increment current_task, update resume_context
2. Overwrite \`docs/mentor/current-task.md\` with next task content (read from mentorFiles.plan in \`.mentor-studio.json\`)

## Intake

Trigger only when:
- \`current-task.md\` does not exist, OR
- \`progress.json\` has no clear next task, OR
- User has no project plan yet

Steps: ask about app idea/goals → target stack → prior knowledge → confirm scope → create first task → update progress.json

## References (load on demand)

- Spec: check \`mentorFiles.spec\` in \`.mentor-studio.json\`
- Plan: check \`mentorFiles.plan\` in \`.mentor-studio.json\`
- Tracker JSON format: \`docs/mentor/skills/mentor-session/tracker-format.md\`
- Code conventions: \`CLAUDE.md\`
`;

export const TRACKER_FORMAT_MD = `# Tracker Format Reference

Load when: this is the first recording action in this session, OR question-history.json is empty or its entries cannot be used to confirm the schema.

## question-history.json

Records every answer to a mentor-asked question, inside a top-level \`"history"\` array.

### Schema

\`\`\`json
{
  "timestamp": "ISO 8601 string",
  "taskId": "string (e.g. phase2.3-task8)",
  "topic": "string",
  "concept": "string (specific concept being tested)",
  "question": "string (exact question asked)",
  "userAnswer": "string",
  "isCorrect": true | false
}
\`\`\`

### Example — correct answer

\`\`\`json
{
  "timestamp": "2026-03-25T00:05:00Z",
  "taskId": "phase2.3-task8",
  "topic": "React hooks",
  "concept": "useEffect dependency array",
  "question": "useEffect の [locale] は何をしている？",
  "userAnswer": "localeが変わったときにeffectを再実行するタイミングをReactに伝える",
  "isCorrect": true
}
\`\`\`

### Example — incorrect answer

\`\`\`json
{
  "timestamp": "2026-03-25T00:02:00Z",
  "taskId": "phase2.3-task8",
  "topic": "React hooks - useEffect dependency array",
  "concept": "useEffect dependency array",
  "question": "useEffect の [locale] は何をしている？",
  "userAnswer": ".mentor-studio.json に保存されたlocale",
  "isCorrect": false
}
\`\`\`

### When to add an entry

Add for ALL answers: correct, incorrect, "I don't know", and partial understanding.
Set \`isCorrect: false\` for incorrect, "I don't know", and partial understanding answers.

## progress.json — unresolved_gaps

Each entry represents a concept gap not yet resolved through a correct review answer.

### Schema

\`\`\`json
{
  "topic": "string",
  "detail": "string (what specifically was misunderstood)"
}
\`\`\`

### Example

\`\`\`json
{
  "topic": "React hooks - useEffect dependency array",
  "detail": "useEffectの依存配列[locale]をファイル保存と誤解した。依存配列はReactがeffectを再実行するタイミングを決めるもの。"
}
\`\`\`

### When to add to unresolved_gaps

When the answer is incorrect, "I don't know", or partial understanding — add to both question-history.json AND unresolved_gaps.

### When to remove from unresolved_gaps

When the user correctly answers a question on this topic **in a different context** (not immediately after being corrected). Record the resolution in question-history.json with \`isCorrect: true\`. Then remove the entry from unresolved_gaps.
`;

export const PROGRESS_JSON = JSON.stringify(
  {
    version: "1.0",
    current_plan: null,
    current_task: "1",
    current_step: null,
    next_suggest: null,
    resume_context: null,
    completed_tasks: [],
    skipped_tasks: [],
    in_progress: [],
    unresolved_gaps: [],
  },
  null,
  2,
);

export const QUESTION_HISTORY_JSON = JSON.stringify({ history: [] }, null, 2);

export const CURRENT_TASK_MD = `# Current Task

No task assigned yet. Run intake to get started.
`;
