# Intake Skill Design

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Extract and repurpose the INTAKE flow as a dedicated learner-profiling skill

---

## Background & Problem

The current `SKILL.md § Intake` has two problems:

1. **Overlap with CREATE_PLAN.md** — it asks about app ideas, goals, and stack, which CREATE_PLAN already handles. This is redundant.
2. **Insufficient learner modeling** — the system has no structured way to understand the user's experience, level, interests, weak areas, or mentoring preferences. `unresolved_gaps` captures misconceptions reactively, but there is no proactive learner profile.

---

## Goal

Repurpose INTAKE from project discovery → **learner profiling**.
Extract it into an independent skill file that the session skill can load on demand.

---

## Architecture

### New file

```
docs/mentor/skills/intake/SKILL.md
```

### Changed files

| File | Change |
|---|---|
| `docs/mentor/skills/mentor-session/SKILL.md` | Remove `## Intake` section; add learner_profile check to Session Start; add observation rules to Teaching Cycle (e)(i) |
| `docs/mentor/progress.json` | Add `learner_profile` field (initial value `null`) |

---

## Trigger Conditions

INTAKE runs in exactly two situations:

1. `progress.json` has no `learner_profile` field (first session ever)
2. User explicitly requests it ("プロフィール更新して" etc.)

**Removed from INTAKE** (belong to CREATE_PLAN.md):
- `current-task.md` does not exist
- `progress.json` has no clear next task
- User has no project plan yet

---

## learner_profile Schema

Added to `progress.json`:

```json
"learner_profile": {
  "experience": "string",
  "level": "beginner | intermediate | advanced",
  "interests": ["string"],
  "weak_areas": ["string"],
  "mentor_style": "string",
  "last_updated": "ISO 8601 string"
}
```

- Fixed 6 fields — does not grow unboundedly
- `interests` and `weak_areas` are arrays updated by **overwrite**, not append
- `mentor_style`: user's preferred mentoring approach (e.g. "ヒントを絞ってほしい", "一緒に考えてほしい")

---

## Onboarding Questions (5 questions, one at a time)

| # | Theme | Example |
|---|---|---|
| 1 | Experience | 「プログラミングはどのくらいやっていますか？何の言語で、何を作ってきましたか？」 |
| 2 | Self-assessed level | 「今の自分のレベルを beginner / intermediate / advanced で表すとしたらどれですか？」 |
| 3 | Interests | 「どんな分野や技術に興味がありますか？将来作ってみたいものはありますか？」 |
| 4 | Weak areas | 「プログラミングで苦手意識がある概念や分野はありますか？」 |
| 5 | Mentor expectations | 「このメンターにどう関わってほしいですか？（ヒントを絞ってほしい、一緒に考えてほしい、等）」 |

After all 5 answers: write `learner_profile` to `progress.json`, then proceed to normal Session Start.

---

## AI Observation Rules (Teaching Cycle updates)

Evaluated at steps **(e) RECORD** and **(i) RECORD** of the Teaching Cycle.

| Observation | Action |
|---|---|
| Concept in `weak_areas` answered correctly in a different context | Ask: 「〇〇の理解が深まったように見えます。`weak_areas` から外していいですか？」|
| Concept not in `weak_areas` where user struggles repeatedly | Ask: 「〇〇が難しそうに見えたので `weak_areas` に追加していいですか？」 |
| Strong interest shown in a topic | Ask: 「〇〇への興味を感じました。`interests` に追加していいですか？」 |

**On YES:** update the field and set `last_updated`.
**On NO:** no change, no internal logging. User owns their profile.

The AI uses `learner_profile` when deciding:
- How to calibrate question difficulty in (b) Ask
- How detailed to make explanations in (a) Explain
- How much scaffolding to offer in (f) Code
- Tone and pacing throughout the session

---

## Integration: SKILL.md Session Start (updated flow)

```
1. Read progress.json → check current_task, resume_context, unresolved_gaps, learner_profile
2. Read current-task.md
3. IF learner_profile is null → load docs/mentor/skills/intake/SKILL.md → run intake
4. (Conditional) If unresolved_gaps match current task topic → propose quick review
5. (Always) If current_task in progress → suggest continue; else ask what to work on
```

---

## Full File-Read Flow (CLAUDE.md entry point)

```
CLAUDE.md (auto-loaded)
  └─ @include MENTOR_RULES.md
       └─ Activation Gate: read .mentor-studio.json
            ├─ NOT FOUND → STOP
            ├─ Parse error → STOP
            ├─ enableMentor: false → normal behavior
            └─ enableMentor: true
                 └─ Session Start: read docs/mentor/skills/mentor-session/SKILL.md
                      ├─ NOT FOUND → search mentor/skills/**
                      │    ├─ NOT FOUND → STOP
                      │    └─ FOUND → continue
                      └─ FOUND → SKILL.md Session Start
                           ├─ read progress.json
                           ├─ read current-task.md
                           ├─ learner_profile null? → load intake/SKILL.md → run intake
                           └─ normal session flow
                                └─ On demand:
                                     ├─ mentorFiles.spec → CREATE_SPEC.md
                                     ├─ mentorFiles.plan → CREATE_PLAN.md
                                     └─ first record → tracker-format.md
```

---

## What Does NOT Change

- Teaching Cycle steps (a)–(i) are unchanged in structure
- BLOCKING RULE (feedback before record) is unchanged
- Task Completion flow is unchanged
- CREATE_PLAN.md and CREATE_SPEC.md are unchanged
