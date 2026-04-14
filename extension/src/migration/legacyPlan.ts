import type { Database } from "sql.js";
import { safeRun } from "./safeRun";

export interface LegacyPlanState {
  legacyPlanId: number | null;
}

function lastInsertRowId(db: Database): number {
  const r = db.exec("SELECT last_insert_rowid()");
  return Number(r[0].values[0][0]);
}

export function ensureLegacyPlan(
  db: Database,
  state: LegacyPlanState,
  now: () => string = () => new Date().toISOString(),
): number {
  if (state.legacyPlanId !== null) return state.legacyPlanId;
  const existing = db.exec(
    "SELECT id FROM plans WHERE name='Legacy' AND filePath IS NULL LIMIT 1",
  );
  if (existing[0]?.values[0]) {
    state.legacyPlanId = Number(existing[0].values[0][0]);
    return state.legacyPlanId;
  }
  const maxRes = db.exec("SELECT COALESCE(MAX(sortOrder), 0) FROM plans");
  const nextSort = Number(maxRes[0].values[0][0]) + 1;
  const stmt = db.prepare(
    "INSERT INTO plans(name, filePath, status, sortOrder, createdAt) VALUES ('Legacy', NULL, 'completed', ?, ?)",
  );
  try {
    safeRun(stmt, "ensureLegacyPlan", "Legacy", [nextSort, now()]);
  } finally {
    stmt.free();
  }
  state.legacyPlanId = lastInsertRowId(db);
  return state.legacyPlanId;
}

export function createPlaceholderTask(
  db: Database,
  legacyPlanId: number,
  oldTaskIdStr: string,
  status: "completed" | "skipped" = "completed",
): number {
  const maxRes = db.exec(
    `SELECT COALESCE(MAX(sortOrder), 0) FROM tasks WHERE planId = ${legacyPlanId}`,
  );
  const nextSort = Number(maxRes[0].values[0][0]) + 1;
  const stmt = db.prepare(
    "INSERT INTO tasks(planId, name, status, sortOrder) VALUES (?, ?, ?, ?)",
  );
  try {
    safeRun(stmt, "createPlaceholderTask", oldTaskIdStr ?? "(no id)", [
      legacyPlanId,
      oldTaskIdStr,
      status,
      nextSort,
    ]);
  } finally {
    stmt.free();
  }
  return lastInsertRowId(db);
}
