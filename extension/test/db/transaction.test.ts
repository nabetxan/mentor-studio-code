import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { SCHEMA_DDL } from "../../src/db/schema";
import { loadSqlJs } from "../../src/db/sqlJsLoader";
import { withWriteTransaction } from "../../src/db/transaction";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

async function seedDb(dbPath: string) {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database();
  db.exec(SCHEMA_DDL);
  db.exec(`INSERT INTO topics(key,label) VALUES ('a-js','JS')`);
  const bytes = Buffer.from(db.export());
  await writeFile(dbPath, bytes);
  db.close();
}

describe("withWriteTransaction", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tx-"));
  });

  it("commits on success and persists changes to disk", async () => {
    const dbPath = join(dir, "data.db");
    await seedDb(dbPath);

    await withWriteTransaction(
      dbPath,
      { wasmPath: WASM, purpose: "normal" },
      (db) => {
        db.exec(`INSERT INTO topics(key,label) VALUES ('a-ts','TS')`);
      },
    );

    const SQL = await loadSqlJs(WASM);
    const reloaded = new SQL.Database(readFileSync(dbPath));
    const rows = reloaded
      .exec("SELECT key FROM topics ORDER BY key")[0]
      .values.flat();
    expect(rows).toEqual(["a-js", "a-ts"]);
  });

  it("rolls back on thrown error — no partial changes on disk", async () => {
    const dbPath = join(dir, "data.db");
    await seedDb(dbPath);

    await expect(
      withWriteTransaction(
        dbPath,
        { wasmPath: WASM, purpose: "normal" },
        (db) => {
          db.exec(`INSERT INTO topics(key,label) VALUES ('a-ts','TS')`);
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");

    const SQL = await loadSqlJs(WASM);
    const reloaded = new SQL.Database(readFileSync(dbPath));
    const rows = reloaded.exec("SELECT key FROM topics")[0].values.flat();
    expect(rows).toEqual(["a-js"]);
  });

  it("releases lock after commit", async () => {
    const dbPath = join(dir, "data.db");
    await seedDb(dbPath);
    await withWriteTransaction(
      dbPath,
      { wasmPath: WASM, purpose: "normal" },
      () => {},
    );
    expect(existsSync(`${dbPath}.lock`)).toBe(false);
  });

  it("releases lock after rollback", async () => {
    const dbPath = join(dir, "data.db");
    await seedDb(dbPath);
    await expect(
      withWriteTransaction(
        dbPath,
        { wasmPath: WASM, purpose: "normal" },
        () => {
          throw new Error("x");
        },
      ),
    ).rejects.toThrow();
    expect(existsSync(`${dbPath}.lock`)).toBe(false);
  });

  it("serializes concurrent writers via lock", async () => {
    const dbPath = join(dir, "data.db");
    await seedDb(dbPath);
    const opts = { wasmPath: WASM, purpose: "normal" as const };
    await Promise.all([
      withWriteTransaction(dbPath, opts, (db) =>
        db.exec(`INSERT INTO topics(key,label) VALUES ('a-a','A')`),
      ),
      withWriteTransaction(dbPath, opts, (db) =>
        db.exec(`INSERT INTO topics(key,label) VALUES ('a-b','B')`),
      ),
      withWriteTransaction(dbPath, opts, (db) =>
        db.exec(`INSERT INTO topics(key,label) VALUES ('a-c','C')`),
      ),
    ]);
    const SQL = await loadSqlJs(WASM);
    const reloaded = new SQL.Database(readFileSync(dbPath));
    const rows = reloaded.exec("SELECT key FROM topics")[0].values.flat();
    const keys = rows.map((v) => String(v)).sort();
    expect(keys).toEqual(["a-a", "a-b", "a-c", "a-js"]);
  });
});
