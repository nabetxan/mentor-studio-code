import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { bootstrapDb, loadSqlJs } from "../../src/db";
import { shouldMigrateV2 } from "../../src/migration/shouldMigrate";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

async function makeV1Db(dir: string): Promise<void> {
  const dbPath = join(dir, "data.db");
  await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database(readFileSync(dbPath));
  db.exec("DROP TABLE IF EXISTS learner_profile");
  db.exec("DROP TABLE IF EXISTS app_state");
  db.exec("PRAGMA user_version = 1");
  writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();
}

describe("shouldMigrateV2", () => {
  it("returns false when data.db is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smv2-"));
    expect(await shouldMigrateV2(dir, WASM)).toBe(false);
  });

  it("returns true when DB user_version is 1 and progress.json exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smv2-"));
    await makeV1Db(dir);
    writeFileSync(join(dir, "progress.json"), "{}");
    expect(await shouldMigrateV2(dir, WASM)).toBe(true);
  });

  it("returns true when DB user_version is 1 even without progress.json (still needs schema bump)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smv2-"));
    await makeV1Db(dir);
    expect(await shouldMigrateV2(dir, WASM)).toBe(true);
  });

  it("returns false when DB is already on SCHEMA_VERSION", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smv2-"));
    const dbPath = join(dir, "data.db");
    await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
    expect(await shouldMigrateV2(dir, WASM)).toBe(false);
  });
});
