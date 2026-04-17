import type { Database } from "sql.js";

export interface ActiveTask {
  id: number;
  name: string;
  planId: number;
}

export function selectActiveTask(db: Database): ActiveTask | null {
  const r = db.exec(
    "SELECT id, name, planId FROM tasks WHERE status='active' LIMIT 1",
  );
  const row = r[0]?.values[0];
  if (!row) return null;
  return { id: Number(row[0]), name: String(row[1]), planId: Number(row[2]) };
}
