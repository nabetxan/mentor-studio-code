import type { Database } from "sql.js";

export interface LegacyTask {
  id: string;
  name: string;
  plan: string;
}

export interface LegacyProgress {
  completed_tasks?: LegacyTask[];
  skipped_tasks?: LegacyTask[];
  current_task?: string | null;
}

export interface LegacyConfig {
  mentorFiles?: { plan?: string | null } | null;
}

export interface InsertPlansResult {
  taskIdMap: Map<string, number>;
}

type LegacyStatus = "completed" | "skipped" | "active" | "queued";

interface TaskRow {
  task: LegacyTask;
  legacyStatus: LegacyStatus;
}

function lastInsertRowId(db: Database): number {
  const r = db.exec("SELECT last_insert_rowid()");
  return Number(r[0].values[0][0]);
}

export async function insertPlans(
  db: Database,
  progress: LegacyProgress,
  config: LegacyConfig,
  readPlanFileHeading: (filePath: string) => Promise<string | null>,
  now: () => string = () => new Date().toISOString(),
): Promise<InsertPlansResult> {
  const completed = progress.completed_tasks ?? [];
  const skipped = progress.skipped_tasks ?? [];
  const currentTaskId = progress.current_task ?? null;
  const activePath = config.mentorFiles?.plan ?? null;

  // Build rows with initial legacy status
  const rows: TaskRow[] = [
    ...completed.map((t): TaskRow => ({ task: t, legacyStatus: "completed" })),
    ...skipped.map((t): TaskRow => ({ task: t, legacyStatus: "skipped" })),
  ];

  // Apply current_task → active (only if not already completed/skipped)
  let currentHandled = false;
  if (currentTaskId !== null) {
    for (const row of rows) {
      if (row.task.id === currentTaskId) {
        currentHandled = true;
        if (
          row.legacyStatus !== "completed" &&
          row.legacyStatus !== "skipped"
        ) {
          row.legacyStatus = "active";
        }
      }
    }
    // Legacy progress.json has no "queued/active" task list — current_task is
    // just a string id. If it doesn't appear in completed/skipped and there is
    // an active plan, synthesize a row so `active_plan_without_open_tasks`
    // (assertStatusInvariants) is satisfied. If it IS in completed/skipped,
    // completed/skipped wins (§9 semantics).
    if (!currentHandled && activePath !== null) {
      rows.push({
        task: { id: currentTaskId, name: currentTaskId, plan: activePath },
        legacyStatus: "active",
      });
      currentHandled = true;
    }
  }

  // Group by plan filePath, preserving first-seen order per plan
  const tasksByPlan = new Map<string, TaskRow[]>();
  for (const row of rows) {
    const list = tasksByPlan.get(row.task.plan) ?? [];
    list.push(row);
    tasksByPlan.set(row.task.plan, list);
  }

  // Decide plan status + resolve heading
  interface PlanEntry {
    filePath: string;
    name: string;
    status: "active" | "completed" | "queued";
    tasks: TaskRow[];
    sortOrder: number;
  }
  const planEntries: PlanEntry[] = [];
  for (const [filePath, tasks] of tasksByPlan) {
    let status: PlanEntry["status"];
    if (filePath === activePath) status = "active";
    else if (tasks.every((t) => t.legacyStatus === "completed"))
      status = "completed";
    else status = "queued";
    const heading = await readPlanFileHeading(filePath);
    planEntries.push({
      filePath,
      name: heading ?? filePath,
      status,
      tasks,
      sortOrder: 0,
    });
  }

  // Sort: completed (0) → active (1) → queued (2)
  const rank = (s: PlanEntry["status"]): number =>
    s === "completed" ? 0 : s === "active" ? 1 : 2;
  planEntries.sort((a, b) => rank(a.status) - rank(b.status));
  planEntries.forEach((p, i) => {
    p.sortOrder = i + 1;
  });

  const taskIdMap = new Map<string, number>();

  // INSERT plans
  const planInsert = db.prepare(
    "INSERT INTO plans(name, filePath, status, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)",
  );
  const taskInsert = db.prepare(
    "INSERT INTO tasks(planId, name, status, sortOrder) VALUES (?, ?, ?, ?)",
  );
  try {
    for (const p of planEntries) {
      planInsert.run([p.name, p.filePath, p.status, p.sortOrder, now()]);
      const planId = lastInsertRowId(db);
      p.tasks.forEach((row, idx) => {
        const taskStatus: string =
          row.legacyStatus === "active"
            ? "active"
            : row.legacyStatus === "completed"
              ? "completed"
              : row.legacyStatus === "skipped"
                ? "skipped"
                : "queued";
        taskInsert.run([planId, row.task.name, taskStatus, idx + 1]);
        const taskId = lastInsertRowId(db);
        taskIdMap.set(row.task.id, taskId);
      });
    }
  } finally {
    planInsert.free();
    taskInsert.free();
  }

  return { taskIdMap };
}
