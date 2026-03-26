export const MENTOR_RULES_MD = `# Mentor Studio Code

## Activation Gate

Read \`.mentor-studio.json\`. If the file does not exist, cannot be parsed, or \`enableMentor\` is \`false\`, skip all rules in this file and behave normally.

## BLOCKING RULE

After the user answers any question the mentor asks, **immediately** record it in \`docs/mentor/question-history.json\`. Do not proceed to the next action (code, next question, task update) until recorded.

## Session Start

Load \`docs/mentor/skills/mentor-session/SKILL.md\`
`;

export const MENTOR_SESSION_SKILL_MD = `---
name: mentor-session
description: Use when starting a mentor session or resuming one — loads session state, teaching cycle rules, task completion procedure, and intake flow.
---

# Mentor Session

## Session Start

1. Read \`docs/mentor/progress.json\` → check current_task, resume_context, unresolved_gaps
2. Read \`docs/mentor/current-task.md\`
3. (Conditional) If unresolved_gaps match current task topic → propose a quick review before beginning
4. (Always) If current_task is actively in progress, suggest continuing it; otherwise ask "What would you like to work on today?"

Do NOT load other docs at session start.

## Teaching Cycle

Mandatory for every concept step:

\`\`\`
(a) Explain concept
(b) Ask 1–2 questions         ← mentor asks
(c) WAIT for user answer
(d) Give feedback
(e) RECORD (GATE)             ← record immediately after user answers; do NOT proceed until recorded
(f) Write/modify code with explanation
(g) Ask verification question ("What does line X do?" / "Why did we use Y?")
(h) WAIT for user answer
(i) RECORD (GATE)             ← same gate applies to post-code verification questions
\`\`\`

The GATE triggers on any question the mentor asks + user answers. All answers get recorded — correct, incorrect, "I don't know", and partial understanding.

Key rules:
- One step at a time — never batch multiple steps
- Never write code before: explaining concept → asking question → waiting for answer
- When user is wrong: affirm effort → correct gently → reinforce with project context example

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
