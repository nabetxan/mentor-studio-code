# Task Management Guide

## When Starting a New Task

1. **Check progress.json**
   - What's the `current_task`?
   - What's in `next_suggest`?
   - What's in `resume_context`? (Use this to greet the user with context)

2. **Load the current task**
   - Open `docs/mentor/current-task.md`
   - Review learning goals and prerequisites

3. **Check for related unresolved gaps**
   - Does the task's topic match any items in `unresolved_gaps`?
   - If yes, propose a quick review of those concepts before starting the task

## When Completing a Task

1. **Update progress.json**

   ```json
   {
     "completed_tasks": [add new task number],
     "current_task": [increment],
     "next_suggest": "[next task name]",
     "resume_context": "1-2 sentence summary of what was accomplished and what comes next"
   }
   ```

   Also record any concepts the user got wrong during this task:
   - Add to `unresolved_gaps` in progress.json
   - Add to `question-history.json`
     (If already recorded via Learning Tracker rules during the session, skip this.)

2. **Update current-task.md**
   - Read `learning-roadmap.md` to find the next task
   - Overwrite `docs/mentor/current-task.md` with the next task's content
   - Only prepare the immediate next task

3. **Update learning-roadmap.md**
   - Find the completed task's row in the task table at the top
   - Change the status from `⬜` to `✅`
   - Also find the task's `### ✅ 完了の定義` section and check off all completed items

## File Organization

```
docs/
  mentor/
    MENTOR_SKILL.md          ← Skill entry point
    core-rules.md            ← Teaching philosophy
    progress.json            ← State tracker (task progress + unresolved_gaps)
    question-history.json    ← Full Q&A history (load on demand only)
    current-task.md          ← Current task content
    task-management.md       ← This file
    intake-and-planning.md   ← One-time project setup

  learning-roadmap.md        ← Overview/index (load only when creating next task)
  app-design.md              ← Reference (load sections on-demand)
```

## Token Budget

**Goal**: Keep session start under 500 tokens

- MENTOR_SKILL.md: ~150 tokens
- progress.json (parsed): ~150 tokens
- current-task.md: ~200 tokens
- **Total**: ~500 tokens

**What NOT to load automatically**:

- question-history.json (only on review/振り返り)
- learning-roadmap.md (only when creating next task)
- app-design.md (only relevant sections on demand)

## Intake + Planning (Only If Needed)

Run intake only when:

- `current-task.md` does not exist, OR
- progress.json does not describe a clear next task, OR
- The repository has no roadmap/design docs yet

If intake is required:

1. Ask about app idea/goals, target platform/stack, and prior knowledge
2. Confirm scope and timeline
3. Create a learning plan and first task
4. Update `progress.json`

Use: `docs/mentor/rules/intake-and-planning.md`

## Cross-Session Continuity

**Problem**: User says "continue" in a new chat
**Solution**: Check progress.json for:

- `current_step`: If set, resume mid-task (e.g., Step 2 of 4)
- `resume_context`: Shows what was accomplished and what's next
- `unresolved_gaps`: Know which concepts to review when relevant

**Example**:

<!-- ```json
{
  "current_task": 20,
  "current_step": 2,
  "resume_context": "Step 1完了。Supabaseプロジェクト作成済み、PostgreSQL URLを.envに設定済み。次はPrismaの接続先変更。"
}
``` -->

New session:

```
Claude: "I see you're on Task 20 Step 2—changing the Prisma connection to Supabase PostgreSQL.
         You already set up the Supabase project and .env last time. Ready to continue?"
```
