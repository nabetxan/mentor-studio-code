import { join } from "node:path";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { SCHEMA_DDL, SCHEMA_VERSION } from "../../src/db/schema";

describe("SCHEMA_DDL", () => {
  async function createDb() {
    const SQL = await initSqlJs({
      locateFile: () => join(__dirname, "..", "..", "dist", "sql-wasm.wasm"),
    });
    const db = new SQL.Database();
    db.exec(SCHEMA_DDL);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    return db;
  }

  it("creates all four tables", async () => {
    const db = await createDb();
    const rows = db
      .exec(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
      )[0]
      .values.flat();
    expect(rows).toEqual(
      expect.arrayContaining(["plans", "questions", "tasks", "topics"]),
    );
  });

  it("enforces at most one active plan via partial unique index", async () => {
    const db = await createDb();
    db.exec(
      `INSERT INTO plans(name,status,sortOrder,createdAt) VALUES ('p1','active',1,'2026-01-01T00:00:00Z')`,
    );
    expect(() =>
      db.exec(
        `INSERT INTO plans(name,status,sortOrder,createdAt) VALUES ('p2','active',2,'2026-01-01T00:00:00Z')`,
      ),
    ).toThrow();
  });

  it("enforces at most one active task via partial unique index", async () => {
    const db = await createDb();
    db.exec(
      `INSERT INTO plans(name,status,sortOrder,createdAt) VALUES ('p1','active',1,'2026-01-01T00:00:00Z')`,
    );
    db.exec(
      `INSERT INTO tasks(planId,name,status,sortOrder) VALUES (1,'t1','active',1)`,
    );
    expect(() =>
      db.exec(
        `INSERT INTO tasks(planId,name,status,sortOrder) VALUES (1,'t2','active',2)`,
      ),
    ).toThrow();
  });

  it("rejects deletion of referenced topic (ON DELETE RESTRICT)", async () => {
    const db = await createDb();
    db.exec(`PRAGMA foreign_keys = ON`);
    db.exec(`INSERT INTO topics(key,label) VALUES ('a-js','JS')`);
    db.exec(
      `INSERT INTO questions(lastAnsweredAt,topicKey,concept,question,userAnswer,isCorrect) VALUES ('2026-01-01T00:00:00Z','a-js','c','q','a',1)`,
    );
    expect(() => db.exec(`DELETE FROM topics WHERE key='a-js'`)).toThrow();
  });

  it("sets user_version to 1", async () => {
    const db = await createDb();
    const version = db.exec("PRAGMA user_version")[0].values[0][0];
    expect(version).toBe(1);
  });
});
