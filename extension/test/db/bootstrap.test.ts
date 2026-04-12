import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { bootstrapDb } from "../../src/db/bootstrap";
import { loadSqlJs } from "../../src/db/sqlJsLoader";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

describe("bootstrapDb", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "boot-"));
  });

  it("creates DB file with schema applied", async () => {
    const dbPath = join(dir, "data.db");
    await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
    expect(existsSync(dbPath)).toBe(true);
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    const tables = db
      .exec(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
      )[0]
      .values.flat();
    expect(tables).toEqual(
      expect.arrayContaining(["plans", "questions", "tasks", "topics"]),
    );
  });

  it("sets user_version = 1", async () => {
    const dbPath = join(dir, "data.db");
    await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    expect(db.exec("PRAGMA user_version")[0].values[0][0]).toBe(1);
  });

  it("seeds initial topics when provided", async () => {
    const dbPath = join(dir, "data.db");
    await bootstrapDb(dbPath, {
      wasmPath: WASM,
      topics: [{ label: "JS" }, { label: "TS" }],
    });
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    const rows = db.exec("SELECT id, label FROM topics ORDER BY id")[0].values;
    expect(rows).toEqual([
      [1, "JS"],
      [2, "TS"],
    ]);
  });

  it("leaves topics empty when topics: []", async () => {
    const dbPath = join(dir, "data.db");
    await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    const count = db.exec("SELECT COUNT(*) FROM topics")[0].values[0][0];
    expect(count).toBe(0);
  });

  it("refuses to overwrite an existing DB", async () => {
    const dbPath = join(dir, "data.db");
    await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
    await expect(
      bootstrapDb(dbPath, { wasmPath: WASM, topics: [] }),
    ).rejects.toThrow(/exists/i);
  });

  it("takes the lock (migration purpose) during bootstrap", async () => {
    const dbPath = join(dir, "data.db");
    await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
    expect(existsSync(`${dbPath}.lock`)).toBe(false);
  });
});
