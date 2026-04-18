import type { Database } from "sql.js";

import type { PlanStatus } from "@mentor-studio/shared";

import { assertStatusInvariants, withWriteTransaction } from "../../db";

function rowExists(
  db: Database,
  table: "plans" | "tasks",
  id: number,
): boolean {
  const r = db.exec(`SELECT 1 FROM ${table} WHERE id = ${id}`);
  return Boolean(r[0]?.values?.length);
}

export async function createPlan(
  dbPath: string,
  args: { name: string; filePath: string | null },
  wasmPath?: string,
): Promise<{ id: number }> {
  return withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    const maxRes = db.exec("SELECT COALESCE(MAX(sortOrder), 0) FROM plans");
    const maxVal = maxRes[0]?.values?.[0]?.[0];
    const nextSort = Number(maxVal ?? 0) + 1;
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(
      "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES (?, ?, 'backlog', ?, ?)",
    );
    try {
      stmt.run([args.name, args.filePath, nextSort, createdAt]);
    } finally {
      stmt.free();
    }
    const idRes = db.exec("SELECT last_insert_rowid()");
    const id = Number(idRes[0].values[0][0]);
    assertStatusInvariants(db);
    return { id };
  });
}

export async function updatePlan(
  dbPath: string,
  args: { id: number; name?: string; filePath?: string | null },
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", args.id)) {
      throw new Error(`plan not found: ${args.id}`);
    }

    const sets: string[] = [];
    const params: Array<string | number | null> = [];
    if (Object.prototype.hasOwnProperty.call(args, "name")) {
      sets.push("name = ?");
      params.push(args.name as string);
    }
    if (Object.prototype.hasOwnProperty.call(args, "filePath")) {
      sets.push("filePath = ?");
      params.push(args.filePath ?? null);
    }

    if (sets.length > 0) {
      params.push(args.id);
      const stmt = db.prepare(
        `UPDATE plans SET ${sets.join(", ")} WHERE id = ?`,
      );
      try {
        stmt.run(params);
      } finally {
        stmt.free();
      }
    }

    assertStatusInvariants(db);
  });
}

/** Hard delete. UI uses removePlan(soft delete). Reserved for CLI/admin paths. */
export async function deletePlan(
  dbPath: string,
  args: { id: number },
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", args.id)) {
      throw new Error(`plan not found: ${args.id}`);
    }
    const childCount = (() => {
      const r = db.exec("SELECT COUNT(*) FROM tasks WHERE planId = ?", [
        args.id,
      ]);
      return Number(r[0]?.values?.[0]?.[0] ?? 0);
    })();
    if (childCount > 0) {
      throw new Error(`plan has dependents: ${childCount} task(s)`);
    }
    const stmt = db.prepare("DELETE FROM plans WHERE id = ?");
    try {
      stmt.run([args.id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function removePlan(
  dbPath: string,
  args: { id: number },
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", args.id)) {
      throw new Error(`plan not found: ${args.id}`);
    }
    const statusRes = db.exec(`SELECT status FROM plans WHERE id = ${args.id}`);
    const currentStatus = String(statusRes[0].values[0][0]);
    if (currentStatus === "active") {
      throw new Error("cannot remove active plan");
    }
    const stmt = db.prepare("UPDATE plans SET status = 'removed' WHERE id = ?");
    try {
      stmt.run([args.id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function restorePlan(
  dbPath: string,
  args: { id: number; toStatus: Exclude<PlanStatus, "active" | "removed"> },
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    const stmt = db.prepare(
      "UPDATE plans SET status = ? WHERE id = ? AND status = 'removed'",
    );
    try {
      stmt.run([args.toStatus, args.id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function activatePlan(
  dbPath: string,
  args: { id: number },
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", args.id)) {
      throw new Error(`plan not found: ${args.id}`);
    }
    // Demote any active tasks that don't belong to the plan we're activating,
    // otherwise they'd violate the active-task-under-active-plan invariant
    // once their plan is moved to 'queued' below.
    const demoteTasks = db.prepare(
      "UPDATE tasks SET status = 'queued' WHERE status = 'active' AND planId != ?",
    );
    try {
      demoteTasks.run([args.id]);
    } finally {
      demoteTasks.free();
    }
    db.exec("UPDATE plans SET status = 'queued' WHERE status = 'active'");
    const stmt = db.prepare("UPDATE plans SET status = 'active' WHERE id = ?");
    try {
      stmt.run([args.id]);
    } finally {
      stmt.free();
    }

    const hasActive = db.exec(
      "SELECT 1 FROM tasks WHERE status = 'active' LIMIT 1",
    );
    if (!hasActive[0]?.values?.length) {
      const firstQueued = db.prepare(
        "SELECT id FROM tasks WHERE planId = ? AND status = 'queued' ORDER BY sortOrder ASC, id ASC LIMIT 1",
      );
      let firstId: number | null = null;
      try {
        firstQueued.bind([args.id]);
        if (firstQueued.step()) firstId = Number(firstQueued.get()[0]);
      } finally {
        firstQueued.free();
      }
      if (firstId !== null) {
        const act = db.prepare(
          "UPDATE tasks SET status = 'active' WHERE id = ?",
        );
        try {
          act.run([firstId]);
        } finally {
          act.free();
        }
      }
    }

    assertStatusInvariants(db);
  });
}

export async function reorderPlans(
  dbPath: string,
  args: { orderedIds: number[] },
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    const stmt = db.prepare("UPDATE plans SET sortOrder = ? WHERE id = ?");
    try {
      for (let i = 0; i < args.orderedIds.length; i++) {
        const id = args.orderedIds[i];
        if (!rowExists(db, "plans", id)) {
          throw new Error(`plan not found: ${id}`);
        }
        stmt.run([i + 1, id]);
      }
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function deactivatePlan(
  dbPath: string,
  args: { id: number },
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    // Demote any active task under this plan first, otherwise queueing the
    // plan would violate the active-task-under-active-plan invariant.
    const demoteTasks = db.prepare(
      "UPDATE tasks SET status = 'queued' WHERE planId = ? AND status = 'active'",
    );
    try {
      demoteTasks.run([args.id]);
    } finally {
      demoteTasks.free();
    }
    const stmt = db.prepare(
      "UPDATE plans SET status = 'queued' WHERE id = ? AND status = 'active'",
    );
    try {
      stmt.run([args.id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function pausePlan(
  dbPath: string,
  id: number,
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", id)) {
      throw new Error(`plan not found: ${id}`);
    }
    // Demote any active task under this plan first, otherwise pausing the
    // plan would violate the active-task-under-active-plan invariant.
    const demoteTasks = db.prepare(
      "UPDATE tasks SET status = 'queued' WHERE planId = ? AND status = 'active'",
    );
    try {
      demoteTasks.run([id]);
    } finally {
      demoteTasks.free();
    }
    const stmt = db.prepare("UPDATE plans SET status = 'paused' WHERE id = ?");
    try {
      stmt.run([id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function changeStatus(
  dbPath: string,
  args: { id: number; toStatus: Exclude<PlanStatus, "active" | "removed"> },
  wasmPath?: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", args.id)) {
      throw new Error(`plan not found: ${args.id}`);
    }
    const s = args.toStatus as string;
    if (s === "active")
      throw new Error("use activatePlan for active transitions");
    if (s === "removed")
      throw new Error("use removePlan for removed transitions");
    // Demote any active task under this plan first, otherwise moving the
    // plan away from 'active' would violate the active-task-under-active-plan
    // invariant.
    const demoteTasks = db.prepare(
      "UPDATE tasks SET status = 'queued' WHERE planId = ? AND status = 'active'",
    );
    try {
      demoteTasks.run([args.id]);
    } finally {
      demoteTasks.free();
    }
    const stmt = db.prepare("UPDATE plans SET status = ? WHERE id = ?");
    try {
      stmt.run([args.toStatus, args.id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}
