# Mentor Rules Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current overlapping mentor rules files with a clean skills-based structure: a thin always-loaded MENTOR_RULES.md + a comprehensive on-demand SKILL.md.

**Architecture:** MENTOR_RULES.md stays tiny (BLOCKING RULE + pointer only) and is always loaded via CLAUDE.md @include. All session logic moves to docs/mentor/skills/mentor-session/SKILL.md with proper skill frontmatter. A supporting tracker-format.md holds JSON schema examples, loaded only when needed.

**Tech Stack:** Markdown files only. No build step. No tests (documentation-only change).

**Spec:** `docs/superpowers/specs/2026-03-25-mentor-rules-redesign.md`

---

## Chunk 1: Create new skill files

### Task 1: Create SKILL.md

**Files:**
- Create: `docs/mentor/skills/mentor-session/SKILL.md`

- [ ] **Step 1: Create the file with this exact content**

```markdown
---
name: mentor-session
description: Use when starting a mentor session or resuming one — loads session state, teaching cycle rules, task completion procedure, and intake flow.
---

# Mentor Session

## Session Start

1. Read `docs/mentor/progress.json` → check current_task, resume_context, unresolved_gaps
2. Read `docs/mentor/current-task.md`
3. (Conditional) If unresolved_gaps match current task topic → propose a quick review before beginning
4. (Always) If current_task is actively in progress, suggest continuing it; otherwise ask "What would you like to work on today?"

Do NOT load other docs at session start.

## Teaching Cycle

Mandatory for every concept step:

```
(a) Explain concept
(b) Ask 1–2 questions         ← mentor asks
(c) WAIT for user answer
(d) Give feedback
(e) RECORD (GATE)             ← record immediately after user answers; do NOT proceed until recorded
(f) Write/modify code with explanation
(g) Ask verification question ("What does line X do?" / "Why did we use Y?")
(h) WAIT for user answer
(i) RECORD (GATE)             ← same gate applies to post-code verification questions
```

The GATE triggers on any question the mentor asks + user answers. All answers get recorded — correct, incorrect, "I don't know", and partial understanding.

Key rules:
- One step at a time — never batch multiple steps
- Never write code before: explaining concept → asking question → waiting for answer
- When user is wrong: affirm effort → correct gently → reinforce with project context example

## Task Completion

Run in order, never skip:

1. Update `docs/mentor/progress.json`: add to completed_tasks, increment current_task, update resume_context
2. Overwrite `docs/mentor/current-task.md` with next task content (read from mentorFiles.plan in `.mentor-studio.json`)

## Intake

Trigger only when:
- `current-task.md` does not exist, OR
- `progress.json` has no clear next task, OR
- User has no project plan yet

Steps: ask about app idea/goals → target stack → prior knowledge → confirm scope → create first task → update progress.json

## References (load on demand)

- Spec: check `mentorFiles.spec` in `.mentor-studio.json`
- Plan: check `mentorFiles.plan` in `.mentor-studio.json`
- Tracker JSON format: `docs/mentor/skills/mentor-session/tracker-format.md`
- Code conventions: `CLAUDE.md`
```

- [ ] **Step 2: Verify against spec checklist**

  - [ ] Frontmatter present with `name` and `description`
  - [ ] Description starts with "Use when..."
  - [ ] Session Start has exactly 4 steps, step 3 is conditional, step 4 is always
  - [ ] Teaching Cycle shows both GATE positions (e) and (i)
  - [ ] GATE note lists all 4 answer types: correct, incorrect, "I don't know", partial understanding
  - [ ] Task Completion has exactly 2 steps (no learning-roadmap.md step)
  - [ ] Intake section has 3 trigger conditions
  - [ ] References section points to tracker-format.md

---

### Task 2: Create tracker-format.md

**Files:**
- Create: `docs/mentor/skills/mentor-session/tracker-format.md`

- [ ] **Step 1: Create the file with this exact content**

  Use the actual schema from the existing `docs/mentor/question-history.json` (fields: timestamp, taskId, topic, concept, question, userAnswer, isCorrect).

```markdown
# Tracker Format Reference

Load when: this is the first recording action in this session, OR question-history.json is empty or its entries cannot be used to confirm the schema.

## question-history.json

Records every answer to a mentor-asked question, inside a top-level `"history"` array.

### Schema

```json
{
  "timestamp": "ISO 8601 string",
  "taskId": "string (e.g. phase2.3-task8)",
  "topic": "string",
  "concept": "string (specific concept being tested)",
  "question": "string (exact question asked)",
  "userAnswer": "string",
  "isCorrect": true | false
}
```

### Example — correct answer

```json
{
  "timestamp": "2026-03-25T00:05:00Z",
  "taskId": "phase2.3-task8",
  "topic": "React hooks",
  "concept": "useEffect dependency array",
  "question": "useEffect の [locale] は何をしている？",
  "userAnswer": "localeが変わったときにeffectを再実行するタイミングをReactに伝える",
  "isCorrect": true
}
```

### Example — incorrect answer

```json
{
  "timestamp": "2026-03-25T00:02:00Z",
  "taskId": "phase2.3-task8",
  "topic": "React hooks - useEffect dependency array",
  "concept": "useEffect dependency array",
  "question": "useEffect の [locale] は何をしている？",
  "userAnswer": ".mentor-studio.json に保存されたlocale",
  "isCorrect": false
}
```

### When to add an entry

Add for ALL answers: correct, incorrect, "I don't know", and partial understanding.
Set `isCorrect: false` for incorrect, "I don't know", and partial understanding answers.

## progress.json — unresolved_gaps

Each entry represents a concept gap not yet resolved through a correct review answer.

### Schema

```json
{
  "topic": "string",
  "detail": "string (what specifically was misunderstood)"
}
```

### Example

```json
{
  "topic": "React hooks - useEffect dependency array",
  "detail": "useEffectの依存配列[locale]をファイル保存と誤解した。依存配列はReactがeffectを再実行するタイミングを決めるもの。"
}
```

### When to add to unresolved_gaps

When the answer is incorrect, "I don't know", or partial understanding — add to both question-history.json AND unresolved_gaps.

### When to remove from unresolved_gaps

When the user correctly answers a question on this topic **in a different context** (not immediately after being corrected). Record the resolution in question-history.json with `isCorrect: true`. Then remove the entry from unresolved_gaps.
```

- [ ] **Step 2: Verify against spec checklist**

  - [ ] Load condition mentions both cases: first session recording + empty/unconfirmable schema
  - [ ] question-history.json schema matches actual file (fields: timestamp, taskId, topic, concept, question, userAnswer, isCorrect)
  - [ ] Both a correct-answer example and incorrect-answer example are present
  - [ ] "When to add" covers all 4 answer types
  - [ ] "When to remove" specifies "different context" condition

- [ ] **Step 3: Commit new skill files**

```bash
git add docs/mentor/skills/mentor-session/SKILL.md docs/mentor/skills/mentor-session/tracker-format.md
git commit -m "feat: add mentor-session skill with proper frontmatter and tracker format reference"
```

---

## Chunk 2: Rewrite MENTOR_RULES.md and delete old files

### Task 3: Rewrite MENTOR_RULES.md

**Files:**
- Modify: `docs/mentor/rules/MENTOR_RULES.md`

- [ ] **Step 1: Rewrite the file with this exact content**

```markdown
# Mentor Studio Code

## BLOCKING RULE

After the user answers any question the mentor asks, **immediately** record it in `docs/mentor/question-history.json`. Do not proceed to the next action (code, next question, task update) until recorded.

## Session Start

Load `docs/mentor/skills/mentor-session/SKILL.md`
```

- [ ] **Step 2: Verify against spec checklist**

  - [ ] File is ~60 words or fewer
  - [ ] Contains BLOCKING RULE
  - [ ] BLOCKING RULE specifies: fires on any mentor-asked question + user answer, before any next action
  - [ ] Contains skill pointer to `docs/mentor/skills/mentor-session/SKILL.md`
  - [ ] Nothing else in the file

---

### Task 4: Delete old files

**Files:**
- Delete: `docs/mentor/rules/MENTOR_SKILL.md`
- Delete: `docs/mentor/rules/core-rules.md`
- Delete: `docs/mentor/rules/learning-tracker-rules.md`

- [ ] **Step 1: Delete all three old files**

```bash
rm docs/mentor/rules/MENTOR_SKILL.md
rm docs/mentor/rules/core-rules.md
rm docs/mentor/rules/learning-tracker-rules.md
```

- [ ] **Step 2: Verify final file structure**

```bash
find docs/mentor/rules docs/mentor/skills -type f | sort
```

Expected output:
```
docs/mentor/rules/MENTOR_RULES.md
docs/mentor/skills/mentor-session/SKILL.md
docs/mentor/skills/mentor-session/tracker-format.md
```

- [ ] **Step 3: Verify CLAUDE.md @include still points to the right path**

```bash
grep "mentor" CLAUDE.md
```

Expected: `@docs/mentor/rules/MENTOR_RULES.md` is still present and unchanged.

- [ ] **Step 4: Commit**

```bash
git add docs/mentor/rules/MENTOR_RULES.md
git rm docs/mentor/rules/MENTOR_SKILL.md docs/mentor/rules/core-rules.md docs/mentor/rules/learning-tracker-rules.md
git commit -m "refactor: migrate mentor rules to skills structure, remove redundant files"
```
