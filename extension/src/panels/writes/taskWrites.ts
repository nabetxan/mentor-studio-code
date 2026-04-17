import type { Database } from "sql.js";

import { assertStatusInvariants, withWriteTransaction } from "../../db";

function rowExists(db: Database, table: string, id: number): boolean {
  const r = db.exec(`SELECT 1 FROM ${table} WHERE id = ${id}`);
  return Boolean(r[0]?.values?.length);
}

export async function createTask(
  dbPath: string,
  args: { planId: number; name: string },
  wasmPath: string,
): Promise<{ id: number }> {
  return withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", args.planId)) {
      throw new Error(`plan not found: ${args.planId}`);
    }

    const maxStmt = db.prepare(
      "SELECT COALESCE(MAX(sortOrder), 0) FROM tasks WHERE planId = ?",
    );
    let nextSort = 1;
    try {
      maxStmt.bind([args.planId]);
      if (maxStmt.step()) {
        nextSort = Number(maxStmt.get()[0] ?? 0) + 1;
      }
    } finally {
      maxStmt.free();
    }

    const stmt = db.prepare(
      "INSERT INTO tasks (planId, name, status, sortOrder) VALUES (?, ?, 'queued', ?)",
    );
    try {
      stmt.run([args.planId, args.name, nextSort]);
    } finally {
      stmt.free();
    }
    const idRes = db.exec("SELECT last_insert_rowid()");
    const id = Number(idRes[0].values[0][0]);
    assertStatusInvariants(db);
    return { id };
  });
}

export async function updateTask(
  dbPath: string,
  args: { id: number; name?: string },
  wasmPath: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "tasks", args.id)) {
      throw new Error(`task not found: ${args.id}`);
    }

    if (Object.prototype.hasOwnProperty.call(args, "name")) {
      const stmt = db.prepare("UPDATE tasks SET name = ? WHERE id = ?");
      try {
        stmt.run([args.name as string, args.id]);
      } finally {
        stmt.free();
      }
    }

    assertStatusInvariants(db);
  });
}

export async function deleteTask(
  dbPath: string,
  args: { id: number },
  wasmPath: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "tasks", args.id)) {
      throw new Error(`task not found: ${args.id}`);
    }
    const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
    try {
      stmt.run([args.id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function reorderTasks(
  dbPath: string,
  args: { planId: number; orderedIds: number[] },
  wasmPath: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", args.planId)) {
      throw new Error(`plan not found: ${args.planId}`);
    }
    const stmt = db.prepare(
      "UPDATE tasks SET sortOrder = ? WHERE id = ? AND planId = ?",
    );
    try {
      for (let i = 0; i < args.orderedIds.length; i++) {
        const id = args.orderedIds[i];
        if (!rowExists(db, "tasks", id)) {
          throw new Error(`task not found: ${id}`);
        }
        const r = db.exec(
          `SELECT 1 FROM tasks WHERE id = ${id} AND planId = ${args.planId}`,
        );
        if (!r[0]?.values?.length) {
          throw new Error(`task ${id} does not belong to plan ${args.planId}`);
        }
        stmt.run([i + 1, id, args.planId]);
      }
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function activateTask(
  dbPath: string,
  args: { id: number },
  wasmPath: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "tasks", args.id)) {
      throw new Error(`task not found: ${args.id}`);
    }
    db.exec("UPDATE tasks SET status = 'queued' WHERE status = 'active'");
    const stmt = db.prepare("UPDATE tasks SET status = 'active' WHERE id = ?");
    try {
      stmt.run([args.id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}
