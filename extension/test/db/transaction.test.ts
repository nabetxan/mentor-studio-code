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
  db.exec(`INSERT INTO topics(label) VALUES ('JS')`);
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
        db.exec(`INSERT INTO topics(label) VALUES ('TS')`);
      },
    );

    const SQL = await loadSqlJs(WASM);
    const reloaded = new SQL.Database(readFileSync(dbPath));
    const rows = reloaded
      .exec("SELECT id, label FROM topics ORDER BY id")[0]
      .values.map((row) => row[1]);
    expect(rows).toEqual(["JS", "TS"]);
  });

  it("rolls back on thrown error — no partial changes on disk", async () => {
    const dbPath = join(dir, "data.db");
    await seedDb(dbPath);

    await expect(
      withWriteTransaction(
        dbPath,
        { wasmPath: WASM, purpose: "normal" },
        (db) => {
          db.exec(`INSERT INTO topics(label) VALUES ('TS')`);
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");

    const SQL = await loadSqlJs(WASM);
    const reloaded = new SQL.Database(readFileSync(dbPath));
    const rows = reloaded.exec("SELECT label FROM topics")[0].values.flat();
    expect(rows).toEqual(["JS"]);
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
        db.exec(`INSERT INTO topics(label) VALUES ('A')`),
      ),
      withWriteTransaction(dbPath, opts, (db) =>
        db.exec(`INSERT INTO topics(label) VALUES ('B')`),
      ),
      withWriteTransaction(dbPath, opts, (db) =>
        db.exec(`INSERT INTO topics(label) VALUES ('C')`),
      ),
    ]);
    const SQL = await loadSqlJs(WASM);
    const reloaded = new SQL.Database(readFileSync(dbPath));
    const rows = reloaded.exec("SELECT label FROM topics")[0].values.flat();
    const labels = rows.map((v) => String(v)).sort();
    expect(labels).toEqual(["A", "B", "C", "JS"]);
  });
});
