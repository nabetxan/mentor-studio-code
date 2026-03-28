# Mentor Rules Redesign — Design Spec
Date: 2026-03-25

## Problem

The current mentor rules have:
- Duplication between `MENTOR_RULES.md` and `MENTOR_SKILL.md`
- `MENTOR_SKILL.md` has no frontmatter — Claude cannot auto-discover it as a skill
- `task-management.md` is referenced but missing
- `core-rules.md` (142 lines) duplicates content already in `MENTOR_SKILL.md`
- Learning-roadmap.md update step in task completion is no longer needed (progress.json tracks everything)

## Decision: Option B — Skills Directory

Keep the always-loaded CLAUDE.md entry point thin. Move full session logic into a proper skill file.

## New File Structure

```
docs/mentor/
  rules/
    MENTOR_RULES.md              ← always-loaded via CLAUDE.md @include (~60 words)
  skills/
    mentor-session/
      SKILL.md                   ← full session logic, proper skill format (~350 tokens)
      tracker-format.md          ← JSON format reference, load on demand only
```

### Files deleted
- `docs/mentor/rules/MENTOR_SKILL.md` — content migrated to skills/mentor-session/SKILL.md
- `docs/mentor/rules/core-rules.md` — content absorbed into SKILL.md
- `docs/mentor/rules/learning-tracker-rules.md` — content migrated into tracker-format.md

### Files intentionally not created
- `docs/mentor/rules/task-management.md` — was referenced but never existed; its intended content (task completion steps) is now embedded directly in SKILL.md Task Completion section
- `docs/mentor/rules/intake-and-planning.md` — was referenced but never existed; intake steps are now embedded in SKILL.md Intake section

### Files created
- `docs/mentor/skills/mentor-session/SKILL.md`
- `docs/mentor/skills/mentor-session/tracker-format.md`

---

## MENTOR_RULES.md — Always-Loaded Entry (~60 words)

Purpose: Minimal always-present context. Only the BLOCKING RULE + pointer to load the skill.

Content:
- BLOCKING RULE: After the user answers any question the mentor asks, record it in `question-history.json` immediately. Do not proceed to next action until recorded.
- Session start: load `docs/mentor/skills/mentor-session/SKILL.md`

Nothing else in this file.

---

## SKILL.md — Full Session Logic

### Frontmatter
```
name: mentor-session
description: Use when starting a mentor session or resuming one — loads session state, teaching cycle rules, task completion procedure, and intake flow.
```

### Sections

#### Session Start (4 steps)
1. Read `docs/mentor/progress.json` → check current_task, resume_context, unresolved_gaps
2. Read `docs/mentor/current-task.md`
3. (Conditional) If unresolved_gaps match current task topic → propose a quick review before beginning
4. (Always) If current_task is actively in progress, suggest continuing it; otherwise ask "What would you like to work on today?"

Do NOT load other docs at session start.

#### Teaching Cycle (mandatory for every step)

```
(a) Explain concept
(b) Ask 1–2 questions         ← mentor asks
(c) WAIT for user answer
(d) Give feedback
(e) RECORD (GATE)             ← record immediately after user answers; do NOT proceed until recorded
(f) Write/modify code with explanation
(g) Ask verification question  ("What does line X do?" / "Why did we use Y?")
(h) WAIT for user answer
(i) RECORD (GATE)             ← same gate applies to post-code verification questions
```

The GATE triggers on any question the mentor asks + user answers. All answers get recorded — correct, incorrect, "I don't know", and partial understanding.

Key rules:
- One step at a time — never batch multiple steps
- Never write code before: explaining concept → asking question → waiting for answer
- When user is wrong: affirm effort → correct gently → reinforce with project context example

#### Task Completion (run in order, never skip)
1. Update `progress.json`: add to completed_tasks, increment current_task, update resume_context
2. Overwrite `docs/mentor/current-task.md` with next task content (read from plan/roadmap)

#### Intake (only when needed)
Trigger when:
- `current-task.md` does not exist, OR
- `progress.json` has no clear next task, OR
- User has no project plan yet

Steps: ask about app idea/goals → target stack → prior knowledge → confirm scope → create first task → update progress.json

#### References (load on demand)
- Spec: check `mentorFiles.spec` in `.mentor-studio.json`
- Plan: check `mentorFiles.plan` in `.mentor-studio.json`
- Tracker JSON format: `docs/mentor/skills/mentor-session/tracker-format.md`
- Code conventions: `CLAUDE.md`

---

## tracker-format.md — JSON Format Reference

Load when: this is the first recording action in this session, OR question-history.json is empty or its entries cannot be used to confirm the schema.

Contains:
- question-history.json entry schema + example (correct and incorrect)
- progress.json unresolved_gaps schema + example
- When to add entries (all answers: correct, incorrect, "I don't know", partial understanding)
- When to remove from unresolved_gaps (correct answer on review in a different context)

---

## What Does NOT Change

- `docs/mentor/progress.json` — data file, untouched
- `docs/mentor/current-task.md` — data file, untouched
- `docs/mentor/question-history.json` — data file, untouched
- `.mentor-studio.json` — config, untouched
- `CLAUDE.md` @include path stays: `@docs/mentor/rules/MENTOR_RULES.md`
