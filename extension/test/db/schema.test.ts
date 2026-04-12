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

  it("inserts a topic with only label and auto-assigns id", async () => {
    const db = await createDb();
    db.exec(`INSERT INTO topics(label) VALUES ('JS')`);
    const result = db.exec(`SELECT id, label FROM topics`)[0];
    expect(result.values.length).toBe(1);
    const [id, label] = result.values[0];
    expect(typeof id).toBe("number");
    expect(label).toBe("JS");
  });

  it("allows duplicate labels with distinct ids (spec §9 prefix-collision behavior)", async () => {
    const db = await createDb();
    db.exec(`INSERT INTO topics(label) VALUES ('JavaScript')`);
    db.exec(`INSERT INTO topics(label) VALUES ('JavaScript')`);
    const result = db.exec(`SELECT id, label FROM topics ORDER BY id`)[0];
    expect(result.values.length).toBe(2);
    const [id1] = result.values[0];
    const [id2] = result.values[1];
    expect(id1).not.toBe(id2);
    expect(result.values[0][1]).toBe("JavaScript");
    expect(result.values[1][1]).toBe("JavaScript");
  });

  it("rejects deletion of referenced topic (ON DELETE RESTRICT)", async () => {
    const db = await createDb();
    db.exec(`PRAGMA foreign_keys = ON`);
    db.exec(`INSERT INTO topics(label) VALUES ('JS')`);
    const topicIdResult = db.exec(`SELECT id FROM topics WHERE label='JS'`)[0];
    const topicId = topicIdResult.values[0][0] as number;
    db.exec(
      `INSERT INTO questions(lastAnsweredAt,topicId,concept,question,userAnswer,isCorrect) VALUES ('2026-01-01T00:00:00Z',${topicId},'c','q','a',1)`,
    );
    expect(() => db.exec(`DELETE FROM topics WHERE id=${topicId}`)).toThrow();
  });

  it("rejects inserting a question with a non-existent topicId (FK violation)", async () => {
    const db = await createDb();
    db.exec(`PRAGMA foreign_keys = ON`);
    expect(() =>
      db.exec(
        `INSERT INTO questions(lastAnsweredAt,topicId,concept,question,userAnswer,isCorrect) VALUES ('2026-01-01T00:00:00Z',999,'c','q','a',1)`,
      ),
    ).toThrow();
  });

  it("has idx_questions_topicId index", async () => {
    const db = await createDb();
    const rows = db
      .exec(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_questions_topicId'`,
      )[0]
      .values.flat();
    expect(rows).toContain("idx_questions_topicId");
  });

  it("sets user_version to 1", async () => {
    const db = await createDb();
    const version = db.exec("PRAGMA user_version")[0].values[0][0];
    expect(version).toBe(1);
  });
});
