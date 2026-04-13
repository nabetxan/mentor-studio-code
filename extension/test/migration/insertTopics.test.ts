import { join } from "node:path";
import type { Database } from "sql.js";
import { describe, expect, it } from "vitest";
import { SCHEMA_DDL } from "../../src/db/schema";
import { loadSqlJs } from "../../src/db/sqlJsLoader";
import { ensureTopicId, insertTopics } from "../../src/migration/insertTopics";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

async function mkDb(): Promise<Database> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database();
  db.exec(SCHEMA_DDL);
  return db;
}

describe("insertTopics", () => {
  it("inserts topics in order, builds oldKey→newId map", async () => {
    const db = await mkDb();
    const map = insertTopics(db, [
      { key: "a-js", label: "JavaScript" },
      { key: "c-react", label: "React" },
    ]);
    expect(map.get("a-js")).toBe(1);
    expect(map.get("c-react")).toBe(2);
    db.close();
  });

  it("allows duplicate labels to become distinct ids", async () => {
    const db = await mkDb();
    const map = insertTopics(db, [
      { key: "a-react", label: "React" },
      { key: "c-react", label: "React" },
    ]);
    expect(map.get("a-react")).not.toBe(map.get("c-react"));
    db.close();
  });
});

describe("ensureTopicId", () => {
  it("creates a new topic on-the-fly if key is absent", async () => {
    const db = await mkDb();
    const map = new Map<string, number>();
    const id = ensureTopicId(db, map, "unknown-topic");
    expect(id).toBe(1);
    expect(map.get("unknown-topic")).toBe(1);
    db.close();
  });

  it("returns existing id if key is present", async () => {
    const db = await mkDb();
    const map = insertTopics(db, [{ key: "a-js", label: "JS" }]);
    expect(ensureTopicId(db, map, "a-js")).toBe(1);
    db.close();
  });
});
