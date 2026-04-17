import { existsSync } from "node:fs";

import { InvariantViolationError, withWriteTransaction } from "../../db";
import type { Command } from "./types";
import { autoAdvance, type AdvanceResult } from "./updateTask/advance";

class TaskNotFoundError extends Error {}
class InvalidTaskStateError extends Error {
  constructor(public readonly currentStatus: string) {
    super(`task is ${currentStatus}, only active tasks can be updated`);
  }
}

function currentPlanState(
  db: import("sql.js").Database,
  planId: number,
): AdvanceResult {
  const active = db.prepare(
    "SELECT id, name FROM tasks WHERE planId = ? AND status = 'active' ORDER BY sortOrder ASC, id ASC LIMIT 1",
  );
  let nextTask: AdvanceResult["nextTask"] = null;
  try {
    active.bind([planId]);
    if (active.step()) {
      const row = active.get();
      nextTask = { id: Number(row[0]), name: String(row[1]), planId };
    }
  } finally {
    active.free();
  }
  const plan = db.prepare("SELECT status FROM plans WHERE id = ?");
  let planCompleted = false;
  try {
    plan.bind([planId]);
    if (plan.step()) planCompleted = String(plan.get()[0]) === "completed";
  } finally {
    plan.free();
  }
  return { nextTask, planCompleted };
}

export const updateTask: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as { id?: unknown; status?: unknown };
  if (!Number.isInteger(args.id)) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "id must be integer",
    };
  }
  if (args.status !== "completed" && args.status !== "skipped") {
    return {
      ok: false,
      error: "invalid_args",
      detail: "status must be completed|skipped",
    };
  }
  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const taskId = args.id as number;
  const status = args.status;

  let advance: AdvanceResult;
  try {
    advance = await withWriteTransaction(
      paths.dbPath,
      { wasmPath: paths.wasmPath, purpose: "normal" },
      (db) => {
        const chk = db.prepare("SELECT planId, status FROM tasks WHERE id = ?");
        let current: { planId: number; status: string } | null = null;
        try {
          chk.bind([taskId]);
          if (chk.step()) {
            const row = chk.get();
            current = { planId: Number(row[0]), status: String(row[1]) };
          }
        } finally {
          chk.free();
        }
        if (current === null) throw new TaskNotFoundError();

        // Idempotence: a task already in a terminal state is a no-op.
        // Re-running autoAdvance here would activate another queued task
        // while the current active task is untouched, breaking invariants.
        if (current.status === "completed" || current.status === "skipped") {
          return currentPlanState(db, current.planId);
        }

        // Reject updates on non-active tasks (e.g. queued): advancing from
        // a queued task would activate a second task under the same plan,
        // tripping the uq_tasks_active partial unique index.
        if (current.status !== "active") {
          throw new InvalidTaskStateError(current.status);
        }

        const upd = db.prepare("UPDATE tasks SET status = ? WHERE id = ?");
        try {
          upd.run([status, taskId]);
        } finally {
          upd.free();
        }

        return autoAdvance(db, current.planId);
      },
    );
  } catch (e) {
    if (e instanceof TaskNotFoundError) {
      return { ok: false, error: "not_found" };
    }
    if (e instanceof InvalidTaskStateError) {
      return {
        ok: false,
        error: "invalid_state",
        detail: e.message,
      };
    }
    if (e instanceof InvariantViolationError) {
      return { ok: false, error: "invariant_violation", detail: e.message };
    }
    throw e;
  }

  return {
    ok: true,
    nextTask: advance.nextTask,
    planCompleted: advance.planCompleted,
  };
};
