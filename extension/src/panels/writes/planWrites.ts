import type { Database } from "sql.js";

import { assertStatusInvariants, withWriteTransaction } from "../../db";

function rowExists(db: Database, table: string, id: number): boolean {
  const r = db.exec(`SELECT 1 FROM ${table} WHERE id = ${id}`);
  return Boolean(r[0]?.values?.length);
}

export async function createPlan(
  dbPath: string,
  args: { name: string; filePath: string | null },
  wasmPath: string,
): Promise<{ id: number }> {
  return withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    const maxRes = db.exec("SELECT COALESCE(MAX(sortOrder), 0) FROM plans");
    const maxVal = maxRes[0]?.values?.[0]?.[0];
    const nextSort = Number(maxVal ?? 0) + 1;
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(
      "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES (?, ?, 'queued', ?, ?)",
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
  wasmPath: string,
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

export async function deletePlan(
  dbPath: string,
  args: { id: number },
  wasmPath: string,
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

export async function activatePlan(
  dbPath: string,
  args: { id: number },
  wasmPath: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", args.id)) {
      throw new Error(`plan not found: ${args.id}`);
    }
    db.exec("UPDATE plans SET status = 'queued' WHERE status = 'active'");
    const stmt = db.prepare("UPDATE plans SET status = 'active' WHERE id = ?");
    try {
      stmt.run([args.id]);
    } finally {
      stmt.free();
    }
    assertStatusInvariants(db);
  });
}

export async function reorderPlans(
  dbPath: string,
  args: { orderedIds: number[] },
  wasmPath: string,
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
  wasmPath: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
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
  wasmPath: string,
): Promise<void> {
  await withWriteTransaction(dbPath, { wasmPath, purpose: "normal" }, (db) => {
    if (!rowExists(db, "plans", id)) {
      throw new Error(`plan not found: ${id}`);
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
