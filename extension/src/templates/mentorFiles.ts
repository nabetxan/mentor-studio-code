export const MENTOR_RULES_MD = `## BLOCKING RULE

A "mentor question" = a question asking the user to recall, apply, or explain what they just learned.
Clarifying questions (e.g. "What do you want to do?") are NOT mentor questions.

Order is fixed — never skip, never reorder:
1. User answers your mentor question
2. Give feedback ← feedback FIRST
3. Ask if it's OK to proceed, wait for user confirmation
4. Record to question-history.json and progress.json ← THEN record
5. Evaluate post-record checks (topic, weak_areas, interests) ← AFTER recording
6. Only after recording AND checks complete → proceed to next step or task

## Activation Gate

Read \`.mentor/config.json\`.

- NOT FOUND → tell the user that \`.mentor/config.json\` was not found and they should run \`Mentor Studio Code: Setup Mentor\` from the command palette. STOP.
- Parse error → STOP.
- \`extensionUninstalled: true\` → read \`locale\` from config, then:
  1. Check both CLAUDE.md files for the line \`@.mentor/rules/MENTOR_RULES.md\`:
     - Project: \`./CLAUDE.md\` (workspace root)
     - Personal: \`~/.claude/projects/<dir>/CLAUDE.md\` (derive \`<dir>\` from the current workspace path by replacing \`/\`, \`\\\`, \`:\` with \`-\`)
  2. For each file that contains the reference, show its path as a clickable link so the user can open and edit it.
  3. Tell the user that Mentor Studio Code has been uninstalled and the listed CLAUDE.md file(s) still contain the \`@.mentor/rules/MENTOR_RULES.md\` reference. Ask them to open each file and remove the line. STOP.
- \`enableMentor: false\` → ignore all rules below, behave normally.
- \`enableMentor: true\` → proceed to Language Rule, then Session Start.

## Language Rule (applies to ALL user-facing text in every section below)

Read \`locale\` from \`.mentor/config.json\` and use that language. If the user writes in a different language, match theirs instead.

## Session Entry

Execute before any other response:

1. Read \`.mentor/skills/mentor-session/SKILL.md\`
   - If NOT FOUND → search for \`SKILL.md\` under any \`mentor/skills/\` directory.
   - If still NOT FOUND → tell the user that SKILL.md was not found and STOP.
2. Route to the correct flow based on the user's request:
   - \`[flow:review]\` → follow **Review** in SKILL.md
   - \`[flow:implementation-review]\` → follow **Implementation Review** in SKILL.md
   - \`[flow:comprehension-check]\` → follow **Comprehension Check** in SKILL.md
   - No flow tag or \`[flow:session-start]\` → follow **Session Start** in SKILL.md
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
- Run an external skill/agent AND the mentor Teaching Cycle at the same time

## External Skill / Agent Handoff

When you determine that the current task requires an external skill or agent (e.g. brainstorming, spec/plan creation, systematic debugging, or any workflow that conflicts with the Teaching Cycle):

1. **Stop the Teaching Cycle** — do not attempt to run both flows simultaneously.
2. **Announce the handoff** — tell the user which skill/agent you are switching to and why. 
3. **Guide next steps** — tell the user:
   - The external skill/agent will take over from here.
   - If a Spec or Plan file is produced, they can set it from the **Settings tab** in Mentor Studio Code.
   - Once set, start a new session to continue with mentor-guided learning.
4. **Proceed with the external skill/agent** — follow its instructions normally.

Do NOT attempt to return to the Teaching Cycle within the same session after handing off.

## Session Start

1. Read \`.mentor/progress.json\` → check current_task, resume_context, unresolved_gaps, learner_profile
2. Read \`.mentor/current-task.md\`
3. If \`learner_profile.last_updated\` is null → load \`.mentor/skills/intake/SKILL.md\` and run Intake flow before proceeding. When Intake returns, continue to step 4 with the now-populated \`learner_profile\` in context.
4. (Conditional) If unresolved_gaps match current task topic → propose a quick review before beginning
5. (Always) If current_task is actively in progress, suggest continuing it; otherwise ask the user what they would like to work on today.

Do NOT load other docs at session start.

## Teaching Cycle

Mandatory for every concept step:

### (a) Explain
Explain the concept with a project-relevant example.
- Match depth and analogies to \`learner_profile.level\`
- Tie examples to \`learner_profile.interests\` where relevant
GATE: explanation given → proceed to (b)

### (b) Ask
Check \`unresolved_gaps\` in progress.json:
- Gaps related to this task's topic → ask a review question on that gap first.
- No relevant gaps → ask 1 question about the concept needed for this step.
  - Calibrate question difficulty to \`learner_profile.level\`
  - Prioritize \`learner_profile.weak_areas\` topics when a related concept appears
- **Context rule**: When the question involves code, ALWAYS include:
  - The relevant code snippet (inline or fenced block)
  - The file path where the code lives (e.g. \`extension/src/services/foo.ts\`)
  - Enough surrounding context for the user to understand what the code does
GATE: question asked → WAIT for user

### (c) Wait
Do NOT continue until the user responds.
GATE: user responded → proceed to (d)

### (d) Feedback
Affirm effort, then judge and respond:
- **Correct** (core concept accurately captured without help) → affirm and reinforce with example.
- **Close / partial** (some correct elements but misses or misunderstands the core point) → affirm what's right, then give a hint or rephrase the question from a different angle. Do NOT reveal the answer yet. WAIT for user to try again. Repeat until correct or user says they give up.
- **Wrong** (misses the core concept entirely, or contradicts the correct answer; any form of "I don't know" is also Wrong) → acknowledge without judgment, then try ONE of: a simpler sub-question, a concrete example, or a different angle. Do NOT immediately give the full answer. WAIT for user to try again. If still stuck after 2 attempts, then explain the answer.

When the user eventually answers correctly after hints/sub-questions, or when you explain the answer → give feedback on their understanding.

After feedback is complete, **always** ask if it's OK to proceed and WAIT (every time, not just after hints). The user may:
- Ask follow-up questions about the feedback
- Confirm understanding
- Simply acknowledge (OK, etc.)

Answer any follow-up questions before proceeding. Once the user is satisfied (or explicitly says to move on), proceed to (e).
GATE: feedback given AND user confirmed to proceed → proceed to (e)

### (e) RECORD ← BLOCKING

Execute in order:

1. Read \`.mentor/config.json\` \`topics\`. Choose the most specific matching topic for the concept. If no existing topic matches → automatically add \`{ "key": "a-<kebab-case>", "label": "<Display Name>" }\` to \`.mentor/config.json\` \`topics\` (prefix \`a-\` is required for AI-generated keys), then continue.
2. Read \`question-history.json\` (verify ID uniqueness).
   - Schema: see \`.mentor/skills/mentor-session/tracker-format.md\`
   - Determine \`isCorrect\`: true ONLY if the user answered correctly on their first attempt without any hints, sub-questions, or explanations from the mentor. Hints aid learning — they do not change the correctness judgment.
   - \`userAnswer\`: record the user's first answer. If there were multiple turns: "[first answer] → (after hint) [final answer]"
   - Then record:
     - \`isCorrect: true\` (regular question) → record to \`question-history.json\`
     - \`isCorrect: true\` (unresolved_gap review) → record to \`question-history.json\` AND remove from \`progress.json\` unresolved_gaps
     - \`isCorrect: false\` → record to \`question-history.json\` AND add to \`progress.json\` unresolved_gaps
3. Post-record checks — evaluate ALL of the following. For each that applies, ask the user one at a time and wait for each answer before asking the next:
   - Concept in \`weak_areas\` answered correctly (\`isCorrect: true\`) in a different context → ask if it should be removed from weak_areas
   - Concept not in \`weak_areas\` where user struggles repeatedly → ask if it should be added to weak_areas
   - Strong interest shown in a topic → ask if it should be added to interests
   - On YES: update \`learner_profile\` in \`progress.json\`, set \`last_updated\` to current ISO 8601 timestamp
   - On NO: no change
   - If none apply, proceed.

GATE: steps 1-3 complete → proceed to (f)

### (f) Code
Write/modify code with line-by-line explanation.
- Scaffolding amount based on \`learner_profile.level\`
- Follow \`learner_profile.mentor_style\` (hints vs. full guidance)
GATE: code written → proceed to (g)

### (g) Verify
Ask exactly 1 verification question about the code just written.
GATE: question asked → WAIT for user response, then proceed to (h)

### (h) Feedback
Follow Teaching Cycle (d) Feedback rules: affirm effort, judge correctness, give hints if partial/wrong, ask if OK to proceed and WAIT.
GATE: feedback given AND user confirmed to proceed → proceed to (i)

### (i) RECORD ← BLOCKING

Execute in order:

1. Read \`.mentor/config.json\` \`topics\`. Choose the most specific matching topic for the concept. If no existing topic matches → automatically add \`{ "key": "a-<kebab-case>", "label": "<Display Name>" }\` to \`.mentor/config.json\` \`topics\` (prefix \`a-\` is required for AI-generated keys), then continue.
2. Read \`question-history.json\` (verify ID uniqueness).
   - Schema: see \`.mentor/skills/mentor-session/tracker-format.md\`
   - Determine \`isCorrect\`: true ONLY if the user answered correctly on their first attempt without any hints, sub-questions, or explanations from the mentor. Hints aid learning — they do not change the correctness judgment.
   - \`userAnswer\`: record the user's first answer. If there were multiple turns: "[first answer] → (after hint) [final answer]"
   - Then record:
     - \`isCorrect: true\` (regular question) → record to \`question-history.json\`
     - \`isCorrect: true\` (unresolved_gap review) → record to \`question-history.json\` AND remove from \`progress.json\` unresolved_gaps
     - \`isCorrect: false\` → record to \`question-history.json\` AND add to \`progress.json\` unresolved_gaps
3. Post-record checks — evaluate ALL of the following. For each that applies, ask the user one at a time and wait for each answer before asking the next:
   - Concept in \`weak_areas\` answered correctly (\`isCorrect: true\`) in a different context → ask if it should be removed from weak_areas
   - Concept not in \`weak_areas\` where user struggles repeatedly → ask if it should be added to weak_areas
   - Strong interest shown in a topic → ask if it should be added to interests
   - On YES: update \`learner_profile\` in \`progress.json\`, set \`last_updated\` to current ISO 8601 timestamp
   - On NO: no change
   - If none apply, proceed.
4. Update \`progress.json\`:
   - \`current_step\`: "Task X, Step Y complete"
   - \`resume_context\`: "Task X Step Y done. Next: [next step description]"
5. Tell the user that progress has been saved and they can continue from here in a new session.

GATE: steps 1-5 complete → cycle complete

## Implementation Review

Triggered when the user asks to review the current task's implementation.

1. Read \`.mentor/current-task.md\` to understand the task requirements.
2. Identify and read the files relevant to the task requirements.
3. Evaluate the implementation against the requirements:
   - Does the code satisfy each requirement?
   - Code quality, readability, and potential issues
   - Suggestions for improvement (if any)
4. Give feedback on the implementation.
5. Ask 1 question about the implementation choices (same rules as Teaching Cycle (b) Ask — include code snippet and file path).
   GATE: question asked → WAIT for user
6. Follow Teaching Cycle (c)→(e): Wait → Feedback → RECORD.
7. After recording, update \`progress.json\` resume_context.

Scope: **task requirements**, not diff or branch. Evaluate whether the code fulfills what \`current-task.md\` describes.

## Review

Triggered when the user asks to review / practice previously missed concepts.

**Scope**: If a specific topic is specified, filter \`unresolved_gaps\` to that topic only. Otherwise, use all \`unresolved_gaps\`.

1. Read \`progress.json\` \`unresolved_gaps\` and \`question-history.json\`.
2. If a specific topic is specified, filter gaps to that topic only. If no matching gaps exist for the specified topic, tell the user that there are no review items for that topic and stop.
3. Read \`learner_profile\` from \`progress.json\` to calibrate difficulty.
4. Select an unresolved gap to review:
   - Prioritize gaps with older \`last_missed\` dates (least recently revisited first)
   - Ask the concept in a **different context** from the original question (not a re-phrasing of the same question)
5. Ask 1 review question (same rules as Teaching Cycle (b) Ask — include code snippet and file path when relevant, calibrate to learner level). Set \`reviewOf\` to the root question ID.
   GATE: question asked → WAIT for user
6. Follow Teaching Cycle (c)→(e): Wait → Feedback → RECORD (on correct: remove from unresolved_gaps; on wrong: keep in unresolved_gaps).
7. After recording:
   - If target gaps are now empty (all gaps for the specified topic, or all gaps if no topic was specified) → congratulate the user that all review items are cleared and stop.
   - Otherwise → ask the user whether they want to continue with another question or see a results summary.
     - User wants to continue → go back to step 4
     - User wants the summary → proceed to step 8
8. Show a results summary:
   - Number of review questions answered in this session
   - Correct / incorrect breakdown
   - Remaining unresolved gaps (if any)

## Comprehension Check

Triggered when the user asks for a comprehension check.

1. Read \`question-history.json\` and \`config.json\` \`topics\` to understand what has been covered.
2. Read \`learner_profile\` from \`progress.json\` to calibrate difficulty.
3. Select a topic to ask about:
   - Prioritize \`learner_profile.weak_areas\`
   - Cover all topics with variety — avoid repeating the same topic consecutively
   - Ask **new** questions (not re-asking the same question from history)
4. Ask 1 question (same rules as Teaching Cycle (b) Ask — include code snippet and file path when relevant, calibrate to learner level).
   GATE: question asked → WAIT for user
5. Follow Teaching Cycle (c)→(e): Wait → Feedback → RECORD.
6. After recording, ask the user whether they want to continue with another question or see a results summary.
   - User wants to continue → go back to step 3
   - User wants the summary → proceed to step 7
7. Show a results summary:
   - Number of questions answered in this session
   - Correct / incorrect breakdown
   - Topics covered and per-topic performance
   - Weak areas identified or confirmed

Difference from Review: Review re-asks concepts the learner previously got wrong (unresolved_gaps). Comprehension Check generates **new questions** across all learned topics to assess overall understanding.

## Task Skip

When the user asks to skip the current task:

1. Add \`{ "task": "<current_task>", "plan": "<current_plan>" }\` to \`skipped_tasks\` in \`.mentor/progress.json\`
2. Follow the "Task Completion" flow below (skip step 1 — the task is not completed)

## Task Completion

Run in order, never skip:

1. Update \`.mentor/progress.json\`: add to completed_tasks, increment current_task, update resume_context
2. Determine the next task:
   a. If \`skipped_tasks\` is not empty → ask the user whether they want to proceed to the next task or work on one of the skipped tasks (list the skipped task names).
      - User chooses next task → read the next task from the plan (mentorFiles.plan in \`.mentor/config.json\`)
      - User chooses a skipped task → remove it from \`skipped_tasks\`, use that task's content
   b. If \`skipped_tasks\` is empty → read the next task from the plan (mentorFiles.plan in \`.mentor/config.json\`)
3. **Immediately** overwrite \`.mentor/current-task.md\` with the selected next task content
4. Update \`.mentor/progress.json\`: set \`current_task\` to the selected task id, update \`resume_context\` to describe the new task

Steps 3 and 4 MUST complete before the session ends. If the session ends before these steps, the next session will start with stale \`current-task.md\`.

## References (load on demand)

- Spec: check \`mentorFiles.spec\` in \`.mentor/config.json\`
- Plan: check \`mentorFiles.plan\` in \`.mentor/config.json\`
- Tracker JSON format: \`.mentor/skills/mentor-session/tracker-format.md\`
- Code conventions: \`CLAUDE.md\`
`;

export const TRACKER_FORMAT_MD = `# Tracker Format Reference

Load when: this is the first recording action in this session, OR question-history.json is empty or its entries cannot be used to confirm the schema.

## question-history.json

Records every answer to a mentor-asked question, inside a top-level \`"history"\` array.

### Schema

\`\`\`json
{
  "id": "string (q_ + 8 random alphanumeric chars [a-zA-Z0-9], unique per entry)",
  "reviewOf": "string | null — null for first-time questions; for review questions, set to the root question id (always the original, never intermediate reviews — e.g. q_aaa→q_bbb→q_ccc: both q_bbb.reviewOf and q_ccc.reviewOf = \"q_aaa\")",
  "answeredAt": "ISO 8601 string",
  "taskId": "string (e.g. phase2.3-task8)",
  "topic": "string (must match a key from .mentor/config.json topics, e.g. a-react)",
  "concept": "string (specific concept being tested)",
  "question": "string (exact question asked)",
  "userAnswer": "string — single-turn: as-is; multi-turn: \"[first answer] → (after hint) [final answer]\"",
  "isCorrect": "true ONLY if correct on first attempt without any hints/sub-questions/explanations; otherwise false"
}
\`\`\`

### Example — correct answer

\`\`\`json
{
  "id": "q_Kx9mP2nL",
  "reviewOf": null,
  "answeredAt": "2026-03-25T00:05:00Z",
  "taskId": "phase2.3-task8",
  "topic": "a-react",
  "concept": "useEffect dependency array",
  "question": "useEffect の [locale] は何をしている？",
  "userAnswer": "localeが変わったときにeffectを再実行するタイミングをReactに伝える",
  "isCorrect": true
}
\`\`\`

### Example — incorrect answer

\`\`\`json
{
  "id": "q_7jRtW3vB",
  "reviewOf": null,
  "answeredAt": "2026-03-25T00:02:00Z",
  "taskId": "phase2.3-task8",
  "topic": "a-react",
  "concept": "useEffect dependency array",
  "question": "useEffect の [locale] は何をしている？",
  "userAnswer": ".mentor/config.json に保存されたlocale",
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
  "questionId": "string (id of the root question-history entry that created this gap)",
  "topic": "string (must match a key from .mentor/config.json topics, e.g. a-react)",
  "concept": "string (specific concept being tested)",
  "last_missed": "ISO 8601 string (timestamp of the most recent incorrect answer)",
  "task": "string (taskId where the gap was first created)",
  "note": "string (what specifically was misunderstood)"
}
\`\`\`

### questionId field rules

- Must match an existing \`id\` in question-history.json (the root entry, i.e. \`reviewOf: null\`)
- When adding a gap from a review question (\`reviewOf\` is not null), use the \`reviewOf\` value (the root id), not the review entry's own \`id\`
- When creating a review question for this gap, set \`reviewOf\` to this \`questionId\`

### last_missed field rules

- Set to the \`answeredAt\` of the incorrect answer when the gap is first created
- **Update** this value each time a review question for this gap is answered incorrectly
- When a review question is answered correctly, the entire gap entry is removed from unresolved_gaps

### Example

\`\`\`json
{
  "questionId": "q_7jRtW3vB",
  "topic": "a-react",
  "concept": "useEffect dependency array",
  "last_missed": "2026-03-25T00:02:00Z",
  "task": "phase2.3-task8",
  "note": "useEffectの依存配列[locale]をファイル保存と誤解した。依存配列はReactがeffectを再実行するタイミングを決めるもの。"
}
\`\`\`

### When to add to unresolved_gaps

When the answer is incorrect, "I don't know", or partial understanding — add to both question-history.json AND unresolved_gaps.

### When to remove from unresolved_gaps

When the user correctly answers a question on this topic **in a different context** (not immediately after being corrected). Record the resolution in question-history.json with \`isCorrect: true\`. Then remove the entry from unresolved_gaps.

## progress.json — learner_profile

Stores structured information about the learner. Written by the intake skill and updated during sessions with user confirmation.

### Schema

\`\`\`json
{
  "experience": "string",
  "level": "beginner | intermediate | advanced",
  "interests": ["string"],
  "weak_areas": ["string"],
  "mentor_style": "string",
  "last_updated": "ISO 8601 string"
}
\`\`\`

### Field descriptions

| Field | Description |
|---|---|
| \`experience\` | Free-text summary of prior programming background |
| \`level\` | Self-assessed skill level |
| \`interests\` | Topics or domains the learner is interested in |
| \`weak_areas\` | Concepts or areas where the learner has low confidence |
| \`mentor_style\` | Preferred mentoring approach (hints only, collaborative, etc.) |
| \`last_updated\` | Timestamp of most recent update (set at intake and on each AI-observed update) |

### When to update

- **Intake:** written in full after all 5 onboarding questions
- **AI observation:** updated field by field during sessions, only after explicit user confirmation
- **User request:** re-run intake skill to overwrite all fields

### Initial value

\`last_updated\` is \`null\` — triggers intake flow at Session Start. All other fields are empty strings or empty arrays.

\`\`\`json
{
  "experience": "",
  "level": "",
  "interests": [],
  "weak_areas": [],
  "mentor_style": "",
  "last_updated": null
}
\`\`\`
`;

export const CREATE_PLAN_MD = `## Plan Creation Rules

### Minimum Valid Plan

- A goal (what to achieve — new app, feature, bug fix, refactor, etc.) — at least 1 sentence
- At least 1 implementation step

### Plan Setup Flow

Triggered when \`mentorFiles.plan\` is null, file does not exist, file has no recognizable structure, or all tasks are complete.

1. Ask the user what they want to build or accomplish. Mention that if they have an existing plan, spec, or notes, they can share the file path or content for reference.
2. If the user provides a file path → read it; if file is unreadable or has no text content → treat as "no structure" and proceed from conversation. If no file provided → infer from conversation.
3. Propose goal + implementation steps → ask user to confirm (revise until confirmed).
4. On confirmation → create a new structured plan file at \`.mentor/plan.md\` (or a timestamped variant if that path is already taken). Original file left untouched if one existed.
5. Tell the user that the plan file has been created at \`<path>\`, and ask if they want to set it as the active plan. Mention that this can always be changed from Settings.
   - If user says no → proceed to Session Start without setting the plan.
6. On OK → directly edit \`.mentor/config.json\` \`mentorFiles.plan\`. If write fails → tell the user to set it manually in Settings.

### All-Tasks-Complete Detection

Count \`## Task N\` headings in plan. If \`completed_tasks.length\` >= heading count → plan complete → trigger Plan Setup Flow.

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

### AI Updating \`.mentor/config.json\`

- Always ask permission before writing.
- Always mention that this can be changed anytime from Settings.
- Write directly to \`.mentor/config.json\`; the extension's fileWatcher auto-reloads.
`;

export const CREATE_SPEC_MD = `## Spec Creation Rules

### Minimum Valid Spec

- Project overview
- Tech stack
- Key features list

### Spec Setup Flow

1. Ask the user what the project is about; ask follow-up questions for missing info.
2. Create spec file.
3. Tell the user that the spec file has been created at \`<path>\`, and ask if they want to set it as the active spec. Mention that this can always be changed from Settings.
   - If user says no → leave \`mentorFiles.spec\` unchanged.
4. On OK → directly edit \`.mentor/config.json\` \`mentorFiles.spec\`. If write fails → tell the user to set it manually in Settings.

### AI Updating \`.mentor/config.json\`

- Always ask permission before writing.
- Always mention that this can be changed anytime from Settings.
- Write directly to \`.mentor/config.json\`; the extension's fileWatcher auto-reloads.
`;

export const PROGRESS_JSON = JSON.stringify(
  {
    version: "1.0",
    current_plan: null,
    current_task: null,
    current_step: null,
    next_suggest: null,
    resume_context: null,
    completed_tasks: [],
    skipped_tasks: [],
    unresolved_gaps: [],
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

Write to \`.mentor/progress.json\` — add or overwrite the \`learner_profile\` field:

\`\`\`json
"learner_profile": {
  "experience": "<answer from Q1>",
  "level": "<beginner|intermediate|advanced from Q2>",
  "interests": ["<parsed from Q3>"],
  "weak_areas": ["<parsed from Q4, empty array if none>"],
  "mentor_style": "<answer from Q5>",
  "last_updated": "<current ISO 8601 timestamp>"
}
\`\`\`

Then tell the user that their profile has been saved and the session will now begin. Return control to the caller to continue from the unresolved_gaps check.
`;

export const QUESTION_HISTORY_JSON = JSON.stringify({ history: [] }, null, 2);

export const CURRENT_TASK_MD = `# Current Task

No task assigned yet. Run intake to get started.
`;
