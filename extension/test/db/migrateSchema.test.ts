import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateSchema } from "../../src/db/migrateSchema";
import { SCHEMA_VERSION } from "../../src/db/schema";
import { loadSqlJs } from "../../src/db/sqlJsLoader";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

/** Build a v1 database (plans.status CHECK without 'backlog'/'removed') */
async function buildV1Db(dbPath: string): Promise<void> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database();
  try {
    db.exec(`
      CREATE TABLE topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL
      );
      CREATE TABLE plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filePath TEXT,
        status TEXT NOT NULL CHECK (status IN ('active','queued','completed','paused')),
        sortOrder INTEGER NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        planId INTEGER NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','queued','completed','skipped')),
        sortOrder INTEGER NOT NULL,
        FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE RESTRICT
      );
      CREATE TABLE questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lastAnsweredAt TEXT NOT NULL,
        taskId INTEGER,
        topicId INTEGER NOT NULL,
        concept TEXT NOT NULL,
        question TEXT NOT NULL,
        userAnswer TEXT NOT NULL,
        isCorrect INTEGER NOT NULL CHECK (isCorrect IN (0,1)),
        note TEXT,
        attempts INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE RESTRICT,
        FOREIGN KEY (topicId) REFERENCES topics(id) ON DELETE RESTRICT
      );
      CREATE INDEX idx_plans_status ON plans(status);
      CREATE INDEX idx_plans_sort ON plans(sortOrder);
      CREATE UNIQUE INDEX uq_plans_active ON plans(status) WHERE status = 'active';
    `);
    db.exec(`PRAGMA user_version = 1`);
    const bytes = Buffer.from(db.export());
    writeFileSync(dbPath, bytes);
  } finally {
    db.close();
  }
}

describe("migrateSchema", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "migrate-"));
  });

  it("upgrades user_version to SCHEMA_VERSION", async () => {
    const dbPath = join(dir, "data.db");
    await buildV1Db(dbPath);

    await migrateSchema(dbPath, { wasmPath: WASM });

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    try {
      const version = db.exec("PRAGMA user_version")[0].values[0][0];
      expect(version).toBe(SCHEMA_VERSION);
    } finally {
      db.close();
    }
  });

  it("preserves existing plans rows after migration", async () => {
    const dbPath = join(dir, "data.db");
    await buildV1Db(dbPath);

    // Insert rows before migration using v1 status values
    const SQL = await loadSqlJs(WASM);
    const preDb = new SQL.Database(readFileSync(dbPath));
    try {
      preDb.exec(`
        INSERT INTO plans(name, status, sortOrder, createdAt)
        VALUES ('Plan A', 'queued', 1, '2026-01-01T00:00:00Z'),
               ('Plan B', 'completed', 2, '2026-01-02T00:00:00Z')
      `);
      writeFileSync(dbPath, Buffer.from(preDb.export()));
    } finally {
      preDb.close();
    }

    await migrateSchema(dbPath, { wasmPath: WASM });

    const db = new SQL.Database(readFileSync(dbPath));
    try {
      const rows = db.exec(
        "SELECT name, status FROM plans ORDER BY sortOrder",
      )[0].values;
      expect(rows).toEqual([
        ["Plan A", "queued"],
        ["Plan B", "completed"],
      ]);
    } finally {
      db.close();
    }
  });

  it("preserves tasks rows with FK pointing to migrated plans", async () => {
    const dbPath = join(dir, "data.db");
    await buildV1Db(dbPath);

    const SQL = await loadSqlJs(WASM);
    const preDb = new SQL.Database(readFileSync(dbPath));
    try {
      preDb.exec(`
        INSERT INTO plans(name, status, sortOrder, createdAt)
        VALUES ('Plan A', 'queued', 1, '2026-01-01T00:00:00Z')
      `);
      preDb.exec(`
        INSERT INTO tasks(planId, name, status, sortOrder)
        VALUES (1, 'Task 1', 'queued', 1)
      `);
      writeFileSync(dbPath, Buffer.from(preDb.export()));
    } finally {
      preDb.close();
    }

    await migrateSchema(dbPath, { wasmPath: WASM });

    const db = new SQL.Database(readFileSync(dbPath));
    try {
      const rows = db.exec(
        "SELECT t.name, p.name FROM tasks t JOIN plans p ON t.planId = p.id",
      )[0].values;
      expect(rows).toEqual([["Task 1", "Plan A"]]);
    } finally {
      db.close();
    }
  });

  it("allows inserting 'backlog' status after migration", async () => {
    const dbPath = join(dir, "data.db");
    await buildV1Db(dbPath);

    await migrateSchema(dbPath, { wasmPath: WASM });

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    try {
      expect(() => {
        db.exec(`
          INSERT INTO plans(name, status, sortOrder, createdAt)
          VALUES ('Backlog Plan', 'backlog', 1, '2026-01-01T00:00:00Z')
        `);
      }).not.toThrow();
    } finally {
      db.close();
    }
  });

  it("allows inserting 'removed' status after migration", async () => {
    const dbPath = join(dir, "data.db");
    await buildV1Db(dbPath);

    await migrateSchema(dbPath, { wasmPath: WASM });

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    try {
      expect(() => {
        db.exec(`
          INSERT INTO plans(name, status, sortOrder, createdAt)
          VALUES ('Removed Plan', 'removed', 1, '2026-01-01T00:00:00Z')
        `);
      }).not.toThrow();
    } finally {
      db.close();
    }
  });

  it("is a no-op when DB is already at SCHEMA_VERSION", async () => {
    const dbPath = join(dir, "data.db");
    await buildV1Db(dbPath);

    // First migration to v2
    await migrateSchema(dbPath, { wasmPath: WASM });

    // Insert a row with new status
    const SQL = await loadSqlJs(WASM);
    const preDb = new SQL.Database(readFileSync(dbPath));
    try {
      preDb.exec(`
        INSERT INTO plans(name, status, sortOrder, createdAt)
        VALUES ('Backlog Plan', 'backlog', 1, '2026-01-01T00:00:00Z')
      `);
      writeFileSync(dbPath, Buffer.from(preDb.export()));
    } finally {
      preDb.close();
    }

    // Run migration again — should be no-op
    await migrateSchema(dbPath, { wasmPath: WASM });

    const db = new SQL.Database(readFileSync(dbPath));
    try {
      const version = db.exec("PRAGMA user_version")[0].values[0][0];
      expect(version).toBe(SCHEMA_VERSION);
      const count = db.exec("SELECT COUNT(*) FROM plans")[0].values[0][0];
      expect(count).toBe(1);
    } finally {
      db.close();
    }
  });

  it("enforces uq_plans_active unique constraint after migration", async () => {
    const dbPath = join(dir, "data.db");
    await buildV1Db(dbPath);

    await migrateSchema(dbPath, { wasmPath: WASM });

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    try {
      db.exec(`
        INSERT INTO plans(name, status, sortOrder, createdAt)
        VALUES ('Active Plan', 'active', 1, '2026-01-01T00:00:00Z')
      `);
      expect(() => {
        db.exec(`
          INSERT INTO plans(name, status, sortOrder, createdAt)
          VALUES ('Second Active', 'active', 2, '2026-01-02T00:00:00Z')
        `);
      }).toThrow();
    } finally {
      db.close();
    }
  });
});
