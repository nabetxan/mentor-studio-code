import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCHEMA_DDL } from "../../src/db/schema";
import { loadSqlJs } from "../../src/db/sqlJsLoader";
import {
  assertStatusInvariants,
  InvariantViolationError,
} from "../../src/db/statusInvariants";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

async function freshDb() {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database();
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA_DDL);
  return db;
}

describe("assertStatusInvariants", () => {
  it("passes for empty DB", async () => {
    const db = await freshDb();
    expect(() => assertStatusInvariants(db)).not.toThrow();
  });

  it("detects active task under non-active plan", async () => {
    const db = await freshDb();
    db.exec(
      `INSERT INTO plans(id,name,status,sortOrder,createdAt) VALUES (1,'p','queued',1,'2026-01-01T00:00:00Z')`,
    );
    db.exec(
      `INSERT INTO tasks(id,planId,name,status,sortOrder) VALUES (1,1,'t','active',1)`,
    );
    expect(() => assertStatusInvariants(db)).toThrow(InvariantViolationError);
  });

  it("detects active plan with no active/queued tasks", async () => {
    const db = await freshDb();
    db.exec(
      `INSERT INTO plans(id,name,status,sortOrder,createdAt) VALUES (1,'p','active',1,'2026-01-01T00:00:00Z')`,
    );
    db.exec(
      `INSERT INTO tasks(id,planId,name,status,sortOrder) VALUES (1,1,'t','completed',1)`,
    );
    expect(() => assertStatusInvariants(db)).toThrow(InvariantViolationError);
  });

  it("detects completed plan with non-terminal tasks", async () => {
    const db = await freshDb();
    db.exec(
      `INSERT INTO plans(id,name,status,sortOrder,createdAt) VALUES (1,'p','completed',1,'2026-01-01T00:00:00Z')`,
    );
    db.exec(
      `INSERT INTO tasks(id,planId,name,status,sortOrder) VALUES (1,1,'t','queued',1)`,
    );
    expect(() => assertStatusInvariants(db)).toThrow(InvariantViolationError);
  });

  it("passes for valid active plan with queued task", async () => {
    const db = await freshDb();
    db.exec(
      `INSERT INTO plans(id,name,status,sortOrder,createdAt) VALUES (1,'p','active',1,'2026-01-01T00:00:00Z')`,
    );
    db.exec(
      `INSERT INTO tasks(id,planId,name,status,sortOrder) VALUES (1,1,'t','queued',1)`,
    );
    expect(() => assertStatusInvariants(db)).not.toThrow();
  });
});
