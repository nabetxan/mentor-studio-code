import type { Database } from "sql.js";

import { assertStatusInvariants } from "../../../db";

export interface AdvanceResult {
  nextTask: { id: number; name: string; planId: number } | null;
  planCompleted: boolean;
}

function autoActivateFirstQueuedTask(db: Database, planId: number): void {
  const hasActive = db.exec(
    "SELECT 1 FROM tasks WHERE status = 'active' LIMIT 1",
  );
  if (hasActive[0]?.values?.length) return;

  const firstQueued = db.prepare(
    "SELECT id FROM tasks WHERE planId = ? AND status = 'queued' ORDER BY sortOrder ASC, id ASC LIMIT 1",
  );
  let firstId: number | null = null;
  try {
    firstQueued.bind([planId]);
    if (firstQueued.step()) firstId = Number(firstQueued.get()[0]);
  } finally {
    firstQueued.free();
  }
  if (firstId === null) return;

  const stmt = db.prepare("UPDATE tasks SET status = 'active' WHERE id = ?");
  try {
    stmt.run([firstId]);
  } finally {
    stmt.free();
  }
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

  const nextPlanStmt = db.prepare(
    "SELECT id FROM plans WHERE status='queued' ORDER BY sortOrder ASC LIMIT 1",
  );
  let nextPlanId: number | null = null;
  try {
    if (nextPlanStmt.step()) {
      nextPlanId = Number(nextPlanStmt.get()[0]);
    }
  } finally {
    nextPlanStmt.free();
  }
  if (nextPlanId !== null) {
    const promote = db.prepare("UPDATE plans SET status='active' WHERE id=?");
    try {
      promote.run([nextPlanId]);
    } finally {
      promote.free();
    }
    autoActivateFirstQueuedTask(db, nextPlanId);
  }

  assertStatusInvariants(db);
  return { nextTask: null, planCompleted: true };
}
