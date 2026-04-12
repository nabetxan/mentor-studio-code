import type { Database } from "sql.js";

export class InvariantViolationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InvariantViolationError";
  }
}

export function assertStatusInvariants(db: Database): void {
  const r1 = db.exec(`
    SELECT t.id FROM tasks t
    JOIN plans p ON p.id = t.planId
    WHERE t.status = 'active' AND p.status != 'active'
  `);
  if (r1[0]?.values?.length) {
    throw new InvariantViolationError(
      "active_task_under_non_active_plan",
      `active task(s) under non-active plan: ids=${r1[0].values.map((v) => v[0]).join(",")}`,
    );
  }

  const r2 = db.exec(`
    SELECT p.id FROM plans p
    WHERE p.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.planId = p.id AND t.status IN ('active','queued')
      )
  `);
  if (r2[0]?.values?.length) {
    throw new InvariantViolationError(
      "active_plan_without_open_tasks",
      `active plan(s) with no open tasks: ids=${r2[0].values.map((v) => v[0]).join(",")}`,
    );
  }

  const r3 = db.exec(`
    SELECT p.id FROM plans p
    WHERE p.status = 'completed'
      AND EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.planId = p.id AND t.status NOT IN ('completed','skipped')
      )
  `);
  if (r3[0]?.values?.length) {
    throw new InvariantViolationError(
      "completed_plan_with_open_tasks",
      `completed plan(s) with non-terminal tasks: ids=${r3[0].values.map((v) => v[0]).join(",")}`,
    );
  }
}
