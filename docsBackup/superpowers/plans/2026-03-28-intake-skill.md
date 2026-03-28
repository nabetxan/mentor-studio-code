# Intake Skill Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract and repurpose the INTAKE section in SKILL.md into a dedicated learner-profiling skill that personalizes the mentor's behavior.

**Architecture:** Three coordinated changes — (1) update `mentor-session/SKILL.md` to remove the old Intake section and wire in the new learner_profile check, (2) create `intake/SKILL.md` with the full onboarding flow and observation rules, (3) update `progress.json` and `tracker-format.md` to include the `learner_profile` schema.

**Tech Stack:** Markdown skill files, JSON data files. No TypeScript code involved.

**Spec:** `docs/superpowers/specs/2026-03-28-intake-skill-design.md`

---

## Chunk 1: Modify mentor-session/SKILL.md

### Task 1: Update Session Start to add learner_profile check

**Files:**
- Modify: `docs/mentor/skills/mentor-session/SKILL.md:16-22`

Current Session Start section (lines 16–22):

```markdown
## Session Start

1. Read `docs/mentor/progress.json` → check current_task, resume_context, unresolved_gaps
2. Read `docs/mentor/current-task.md`
3. (Conditional) If unresolved_gaps match current task topic → propose a quick review before beginning
4. (Always) If current_task is actively in progress, suggest continuing it; otherwise ask "What would you like to work on today?"

Do NOT load other docs at session start.
```

- [ ] **Step 1: Replace Session Start section**

Replace the exact block above with:

```markdown
## Session Start

1. Read `docs/mentor/progress.json` → check current_task, resume_context, unresolved_gaps, learner_profile
2. Read `docs/mentor/current-task.md`
3. If `learner_profile` is null → load `docs/mentor/skills/intake/SKILL.md` and run Intake flow before proceeding
4. (Conditional) If unresolved_gaps match current task topic → propose a quick review before beginning
5. (Always) If current_task is actively in progress, suggest continuing it; otherwise ask "What would you like to work on today?"

Do NOT load other docs at session start.
```

- [ ] **Step 2: Verify**

Read `docs/mentor/skills/mentor-session/SKILL.md` lines 16–23 and confirm:
- Step 3 checks `learner_profile`
- Step 4 is the unresolved_gaps check (was step 3)
- Step 5 is the always-run check (was step 4)

---

### Task 2: Remove the old `## Intake` section

**Files:**
- Modify: `docs/mentor/skills/mentor-session/SKILL.md:87-94`

Current section to remove (lines 87–94):

```markdown
## Intake

Trigger only when:
- `current-task.md` does not exist, OR
- `progress.json` has no clear next task, OR
- User has no project plan yet

Steps: ask about app idea/goals → target stack → prior knowledge → confirm scope → create first task → update progress.json
```

- [ ] **Step 1: Delete the `## Intake` section**

Delete all lines from `## Intake` up to and including the blank line before `## References`, so the `## References` heading follows directly after `## Task Completion`.

- [ ] **Step 2: Verify**

Read `docs/mentor/skills/mentor-session/SKILL.md` and confirm `## Intake` no longer appears in the file.

---

### Task 3: Add learner_profile observation rules to Teaching Cycle (e) RECORD

**Files:**
- Modify: `docs/mentor/skills/mentor-session/SKILL.md` — step (e) RECORD

Current (e) RECORD block:

```markdown
### (e) RECORD ← BLOCKING
- Correct answer (regular question) → record to `question-history.json`
- Correct answer (unresolved_gap review) → record to `question-history.json` AND remove from `progress.json` unresolved_gaps
- Wrong / "I don't know" / partial → record to `question-history.json` AND add to `progress.json` unresolved_gaps
- Schema: see `docs/mentor/skills/mentor-session/tracker-format.md`
GATE: recorded → proceed to (f)
```

- [ ] **Step 1: Replace (e) RECORD block**

Replace with:

```markdown
### (e) RECORD ← BLOCKING
- Correct answer (regular question) → record to `question-history.json`
- Correct answer (unresolved_gap review) → record to `question-history.json` AND remove from `progress.json` unresolved_gaps
- Wrong / "I don't know" / partial → record to `question-history.json` AND add to `progress.json` unresolved_gaps
- Schema: see `docs/mentor/skills/mentor-session/tracker-format.md`

After recording, check for learner_profile updates (ask user to confirm each):
- Concept in `weak_areas` answered correctly in a different context → ask: 「〇〇の理解が深まったように見えます。weak_areas から外していいですか？」
- Concept not in `weak_areas` where user struggles repeatedly → ask: 「〇〇が難しそうに見えたので weak_areas に追加していいですか？」
- Strong interest shown in a topic → ask: 「〇〇への興味を感じました。interests に追加していいですか？」
On YES: update `learner_profile` in `progress.json`, set `last_updated` to current ISO 8601 timestamp
On NO: no change, no internal logging

GATE: recorded → proceed to (f)
```

- [ ] **Step 2: Verify**

Read the updated (e) RECORD section and confirm all 3 observation conditions are present and the YES/NO handling is explicit.

---

### Task 4: Add same observation rules to Teaching Cycle (i) RECORD

**Files:**
- Modify: `docs/mentor/skills/mentor-session/SKILL.md` — step (i) RECORD

Current (i) RECORD block (lines 66–78):

```markdown
### (i) RECORD ← BLOCKING
- Correct answer (regular question) → record to `question-history.json`
- Correct answer (unresolved_gap review) → record to `question-history.json` AND remove from `progress.json` unresolved_gaps
- Wrong / "I don't know" / partial → record to `question-history.json` AND add to `progress.json` unresolved_gaps
- Schema: see `docs/mentor/skills/mentor-session/tracker-format.md`

Update `progress.json`:
  - `current_step`: "Task X, Step Y complete"
  - `resume_context`: "Task X Step Y done. Next: [next step description]"

Then say: "進捗を保存しました。ここで一区切りです。新しいセッションで続きから始められます。"

GATE: recorded + progress.json updated + message sent → cycle complete
```

- [ ] **Step 1: Insert observation rules into (i) RECORD**

After the `- Schema: see \`docs/mentor/skills/mentor-session/tracker-format.md\`` line and before the blank line that precedes `Update progress.json:`, insert the following block (including a trailing blank line):

```markdown
After recording, check for learner_profile updates (ask user to confirm each):
- Concept in `weak_areas` answered correctly in a different context → ask: 「〇〇の理解が深まったように見えます。weak_areas から外していいですか？」
- Concept not in `weak_areas` where user struggles repeatedly → ask: 「〇〇が難しそうに見えたので weak_areas に追加していいですか？」
- Strong interest shown in a topic → ask: 「〇〇への興味を感じました。interests に追加していいですか？」
On YES: update `learner_profile` in `progress.json`, set `last_updated` to current ISO 8601 timestamp
On NO: no change, no internal logging

```

- [ ] **Step 2: Verify**

Read the full (i) RECORD section and confirm observation rules appear before `Update progress.json:`.

---

---

## Chunk 2: Create intake/SKILL.md

### Task 6: Create the intake skill file

**Files:**
- Create: `docs/mentor/skills/intake/SKILL.md`

- [ ] **Step 1: Create the file with full content**

```markdown
---
name: intake
description: Use when learner_profile is null in progress.json or user requests profile update — collects learner background, level, interests, weak areas, and mentor style through 5 sequential questions.
---

# Intake

## Purpose

Collect structured information about the learner to personalize the mentoring experience. This skill runs BEFORE any task work begins.

## NEVER

- Ask more than 1 question at a time
- Skip any of the 5 questions
- Proceed to session work before writing learner_profile to progress.json

## Intake Flow

Ask each question one at a time. Wait for the user's full answer before proceeding to the next.

### Question 1: Experience

「プログラミングはどのくらいやっていますか？これまで主にどの言語で、どんなものを作ってきたか教えてください。」

### Question 2: Self-assessed Level

「今の自分のレベルを教えてください。beginner（基礎を学んでいる段階）/ intermediate（ひと通り書けるが深い理解は途中）/ advanced（設計・最適化まで自信がある）のどれに近いですか？」

### Question 3: Interests

「どんな分野や技術に興味がありますか？将来作ってみたいものや、触れてみたい技術があれば教えてください。」

### Question 4: Weak Areas

「プログラミングで苦手意識がある概念や分野はありますか？なくても構いません。」

### Question 5: Mentor Style

「このメンターにどう関わってほしいですか？例えば『なるべくヒントだけ出してほしい』『一緒に考えてほしい』『どんどん進めてほしい』など、自由に教えてください。」

## After All 5 Answers

Write to `docs/mentor/progress.json` — add or overwrite the `learner_profile` field:

```json
"learner_profile": {
  "experience": "<answer from Q1>",
  "level": "<beginner|intermediate|advanced from Q2>",
  "interests": ["<parsed from Q3>"],
  "weak_areas": ["<parsed from Q4, empty array if none>"],
  "mentor_style": "<answer from Q5>",
  "last_updated": "<current ISO 8601 timestamp>"
}
```

Then say: 「プロフィールを保存しました。では始めましょう！」and return control to the caller to continue from the unresolved_gaps check.

## How learner_profile Shapes Mentoring

Use `learner_profile` to calibrate every part of the Teaching Cycle:

| Step | How to use learner_profile |
|---|---|
| (a) Explain | Match depth and analogies to `level`; tie examples to `interests` where relevant |
| (b) Ask | Calibrate question difficulty to `level`; prioritize `weak_areas` topics when a related concept appears |
| (f) Code | Amount of scaffolding based on `level`; follow `mentor_style` (more hints vs. more guidance) |
| Tone | Pacing and encouragement style matches `mentor_style` |
```

- [ ] **Step 2: Verify**

Read `docs/mentor/skills/intake/SKILL.md` and confirm:
- Frontmatter is present (name, description)
- 5 questions are present and in order
- After-5-answers section writes to progress.json
- How-to-use table is present

---

## Chunk 3: Update data files and documentation

### Task 8: Add learner_profile to progress.json

**Files:**
- Modify: `docs/mentor/progress.json`

Current `progress.json`:

```json
{
  "version": "1.0",
  "current_plan": null,
  "current_task": null,
  "current_step": null,
  "next_suggest": null,
  "resume_context": null,
  "completed_tasks": [],
  "skipped_tasks": [],
  "unresolved_gaps": []
}
```

- [ ] **Step 1: Add learner_profile field**

Replace with:

```json
{
  "version": "1.0",
  "current_plan": null,
  "current_task": null,
  "current_step": null,
  "next_suggest": null,
  "resume_context": null,
  "completed_tasks": [],
  "skipped_tasks": [],
  "unresolved_gaps": [],
  "learner_profile": null
}
```

- [ ] **Step 2: Verify**

Read `docs/mentor/progress.json` and confirm `"learner_profile": null` is the last field.

---

### Task 9: Document learner_profile schema in tracker-format.md

**Files:**
- Modify: `docs/mentor/skills/mentor-session/tracker-format.md`

- [ ] **Step 1: Append learner_profile section**

Append to the end of `tracker-format.md`:

```markdown
## progress.json — learner_profile

Stores structured information about the learner. Written by the intake skill and updated during sessions with user confirmation.

### Schema

```json
{
  "experience": "string",
  "level": "beginner | intermediate | advanced",
  "interests": ["string"],
  "weak_areas": ["string"],
  "mentor_style": "string",
  "last_updated": "ISO 8601 string"
}
```

### Field descriptions

| Field | Description |
|---|---|
| `experience` | Free-text summary of prior programming background |
| `level` | Self-assessed skill level |
| `interests` | Topics or domains the learner is interested in |
| `weak_areas` | Concepts or areas where the learner has low confidence |
| `mentor_style` | Preferred mentoring approach (hints only, collaborative, etc.) |
| `last_updated` | Timestamp of most recent update (set at intake and on each AI-observed update) |

### When to update

- **Intake:** written in full after all 5 onboarding questions
- **AI observation:** updated field by field during sessions, only after explicit user confirmation
- **User request:** re-run intake skill to overwrite all fields

### Initial value

`null` — triggers intake flow at Session Start.
```

- [ ] **Step 2: Verify**

Read `docs/mentor/skills/mentor-session/tracker-format.md` and confirm `## progress.json — learner_profile` section is appended at the end.

---

---

## Final Verification

- [ ] Read `docs/mentor/skills/mentor-session/SKILL.md` Session Start — confirm step 3 checks `learner_profile`, old `## Intake` section is gone
- [ ] Read `docs/mentor/skills/intake/SKILL.md` — confirm file exists with 5 questions and write logic
- [ ] Read `docs/mentor/progress.json` — confirm `"learner_profile": null` field is present
- [ ] Read `docs/mentor/skills/mentor-session/tracker-format.md` — confirm schema is documented
- [ ] Confirm no references to old Intake trigger conditions remain in SKILL.md (`current-task.md does not exist`, `no clear next task`, `no project plan yet`)
