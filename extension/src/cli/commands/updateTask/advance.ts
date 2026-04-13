import type { Database } from "sql.js";

import { assertStatusInvariants } from "../../../db";

export interface AdvanceResult {
  nextTask: { id: number; name: string; planId: number } | null;
  planCompleted: boolean;
}

export function autoAdvance(db: Database, planId: number): AdvanceResult {
  const nextStmt = db.prepare(
    "SELECT id, name FROM tasks WHERE planId = ? AND status = 'queued' ORDER BY sortOrder ASC, id ASC LIMIT 1",
  );
  let next: { id: number; name: string } | null = null;
  try {
    nextStmt.bind([planId]);
    if (nextStmt.step()) {
      const row = nextStmt.get();
      next = { id: Number(row[0]), name: String(row[1]) };
    }
  } finally {
    nextStmt.free();
  }

  if (next) {
    const upd = db.prepare("UPDATE tasks SET status = 'active' WHERE id = ?");
    try {
      upd.run([next.id]);
    } finally {
      upd.free();
    }
    assertStatusInvariants(db);
    return {
      nextTask: { id: next.id, name: next.name, planId },
      planCompleted: false,
    };
  }

  const planUpd = db.prepare(
    "UPDATE plans SET status = 'completed' WHERE id = ?",
  );
  try {
    planUpd.run([planId]);
  } finally {
    planUpd.free();
  }
  assertStatusInvariants(db);
  return { nextTask: null, planCompleted: true };
}
