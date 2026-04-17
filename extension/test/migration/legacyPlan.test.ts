import { join } from "node:path";
import type { Database } from "sql.js";
import { describe, expect, it } from "vitest";
import { SCHEMA_DDL } from "../../src/db/schema";
import { loadSqlJs } from "../../src/db/sqlJsLoader";
import { insertPlans } from "../../src/migration/insertPlans";
import {
  createPlaceholderTask,
  ensureLegacyPlan,
  type LegacyPlanState,
} from "../../src/migration/legacyPlan";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");
const noHeading = async () => null;

async function mkDb(): Promise<Database> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database();
  db.exec(SCHEMA_DDL);
  return db;
}

describe("ensureLegacyPlan", () => {
  it("creates Legacy plan on first call, returns same id on subsequent calls", async () => {
    const db = await mkDb();
    await insertPlans(
      db,
      {
        completed_tasks: [
          { id: "t1", name: "T1", plan: "p1.md" },
          { id: "t2", name: "T2", plan: "p2.md" },
        ],
        skipped_tasks: [],
        current_task: null,
      },
      {},
      noHeading,
    );
    const state: LegacyPlanState = { legacyPlanId: null };
    const id1 = ensureLegacyPlan(db, state);
    const id2 = ensureLegacyPlan(db, state);
    expect(id1).toBe(id2);
    expect(state.legacyPlanId).toBe(id1);

    const res = db.exec(
      `SELECT name, filePath, status, sortOrder FROM plans WHERE id = ${id1}`,
    );
    const row = res[0].values[0];
    expect(row[0]).toBe("Legacy");
    expect(row[1]).toBeNull();
    expect(row[2]).toBe("completed");
    expect(row[3]).toBe(3);
    db.close();
  });

  it("independent state objects reuse the DB's existing Legacy plan", async () => {
    const db = await mkDb();
    const s1: LegacyPlanState = { legacyPlanId: null };
    const s2: LegacyPlanState = { legacyPlanId: null };
    const id1 = ensureLegacyPlan(db, s1);
    const id2 = ensureLegacyPlan(db, s2);
    expect(id2).toBe(id1);
    expect(s2.legacyPlanId).toBe(id1);
    db.close();
  });
});

describe("createPlaceholderTask", () => {
  it("creates a completed task under Legacy plan with incrementing sortOrder", async () => {
    const db = await mkDb();
    const state: LegacyPlanState = { legacyPlanId: null };
    const legacyId = ensureLegacyPlan(db, state);
    const t1 = createPlaceholderTask(db, legacyId, "orphan-1");
    const t2 = createPlaceholderTask(db, legacyId, "orphan-2");
    expect(t1).not.toBe(t2);
    const tasks = db.exec(
      `SELECT name, status, sortOrder FROM tasks WHERE planId = ${legacyId} ORDER BY sortOrder`,
    );
    expect(tasks[0].values).toEqual([
      ["orphan-1", "completed", 1],
      ["orphan-2", "completed", 2],
    ]);
    db.close();
  });
});
