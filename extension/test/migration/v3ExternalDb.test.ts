import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSqlJs } from "../../src/db/sqlJsLoader";
import { migrateToV3, shouldMigrateV3 } from "../../src/migration/v3ExternalDb";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

async function seedLegacyDb(path: string): Promise<void> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database();
  db.exec("CREATE TABLE topics (id INTEGER PRIMARY KEY, label TEXT)");
  db.exec("INSERT INTO topics(label) VALUES ('TS')");
  const bytes = Buffer.from(db.export());
  db.close();
  writeFileSync(path, bytes);
}

describe("v3ExternalDb migration", () => {
  let work: string;
  let legacyDb: string;
  let externalRoot: string;
  let externalDb: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), "v3-ws-"));
    mkdirSync(join(work, ".mentor"));
    legacyDb = join(work, ".mentor", "data.db");
    externalRoot = mkdtempSync(join(tmpdir(), "v3-ext-"));
    externalDb = join(externalRoot, "uuid-1", "data.db");
  });

  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
    rmSync(externalRoot, { recursive: true, force: true });
  });

  it("shouldMigrateV3: legacy exists → true (regardless of external)", async () => {
    await seedLegacyDb(legacyDb);
    expect(shouldMigrateV3(legacyDb)).toBe(true);
  });

  it("shouldMigrateV3: legacy missing → false", () => {
    expect(shouldMigrateV3(legacyDb)).toBe(false);
  });

  it("migrateToV3: copies DB to external preserving content, renames legacy", async () => {
    await seedLegacyDb(legacyDb);
    await migrateToV3(legacyDb, externalDb);

    expect(existsSync(externalDb)).toBe(true);
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(externalDb));
    const labels = db.exec("SELECT label FROM topics")[0].values.flat();
    expect(labels).toContain("TS");
    db.close();

    expect(existsSync(legacyDb)).toBe(false);
    const today = new Date().toISOString().slice(0, 10);
    expect(existsSync(`${legacyDb}.migrated-${today}`)).toBe(true);
  });

  it("migrateToV3: renames .bak (but leaves .lock alone — see plan rationale)", async () => {
    await seedLegacyDb(legacyDb);
    writeFileSync(`${legacyDb}.bak`, "old backup");
    mkdirSync(`${legacyDb}.lock`); // .lock is a directory in this codebase
    await migrateToV3(legacyDb, externalDb);
    const today = new Date().toISOString().slice(0, 10);
    expect(existsSync(`${legacyDb}.bak.migrated-${today}`)).toBe(true);
    // .lock is intentionally NOT renamed: it may be held by the orchestrator's
    // acquireLock(legacyDbPath, "migration"). It is harmless runtime state.
    expect(existsSync(`${legacyDb}.lock`)).toBe(true);
    expect(existsSync(`${legacyDb}.lock.migrated-${today}`)).toBe(false);
  });

  it("migrateToV3: appends -N counter when target rename exists", async () => {
    await seedLegacyDb(legacyDb);
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(`${legacyDb}.migrated-${today}`, "from earlier");
    await migrateToV3(legacyDb, externalDb);
    expect(existsSync(`${legacyDb}.migrated-${today}-1`)).toBe(true);
  });

  it("migrateToV3: creates external parent dir if missing", async () => {
    await seedLegacyDb(legacyDb);
    expect(existsSync(join(externalRoot, "uuid-1"))).toBe(false);
    await migrateToV3(legacyDb, externalDb);
    expect(existsSync(join(externalRoot, "uuid-1"))).toBe(true);
    expect(existsSync(externalDb)).toBe(true);
  });

  it("migrateToV3: when external already exists (partial-failure recovery), skips copy but renames legacy", async () => {
    await seedLegacyDb(legacyDb);
    mkdirSync(join(externalRoot, "uuid-1"), { recursive: true });
    writeFileSync(externalDb, Buffer.from("preserved external bytes"));

    await migrateToV3(legacyDb, externalDb);

    expect(readFileSync(externalDb).toString()).toBe("preserved external bytes");
    const today = new Date().toISOString().slice(0, 10);
    expect(existsSync(`${legacyDb}.migrated-${today}`)).toBe(true);
    expect(existsSync(legacyDb)).toBe(false);
  });

  it("migrateToV3: idempotent — second invocation when legacy already gone is a no-op", async () => {
    await seedLegacyDb(legacyDb);
    await migrateToV3(legacyDb, externalDb);
    expect(shouldMigrateV3(legacyDb)).toBe(false);
    await expect(migrateToV3(legacyDb, externalDb)).resolves.toBeUndefined();
  });

  it("migrateToV3: surfaces mkdir failure and leaves legacy untouched", async () => {
    await seedLegacyDb(legacyDb);
    // Place a regular file where the parent dir should be — mkdir(..., recursive:true)
    // throws ENOTDIR before atomicWriteFile is reached. We're verifying that the
    // failure aborts cleanly: no external file leaked, legacy still present.
    writeFileSync(join(externalRoot, "uuid-1"), "");
    await expect(migrateToV3(legacyDb, externalDb)).rejects.toThrow();
    expect(existsSync(externalDb)).toBe(false);
    expect(existsSync(legacyDb)).toBe(true);
  });

  // Note: the unlink-on-failure branch in v3ExternalDb (lines 53-60) is defensive
  // belt-and-suspenders — atomicWriteFile already cleans up its own tmp file on
  // any failure, so reaching that outer cleanup requires injecting a fault that
  // ESM static-import binding semantics make impractical to mock without module-
  // level vi.mock that would break the rest of this suite. Left intentionally
  // untested rather than asserting a behavior the test isn't actually exercising.
});
