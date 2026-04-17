import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { checkIntegrity, quarantineCorruptDb } from "../../src/db/integrity";
import { SCHEMA_DDL } from "../../src/db/schema";
import { loadSqlJs } from "../../src/db/sqlJsLoader";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

describe("integrity", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "integ-"));
  });

  it("returns ok for healthy DB", async () => {
    const dbPath = join(dir, "data.db");
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database();
    db.exec(SCHEMA_DDL);
    await writeFile(dbPath, Buffer.from(db.export()));
    db.close();
    const result = await checkIntegrity(dbPath, WASM);
    expect(result.ok).toBe(true);
  });

  it("returns not-ok for garbage file", async () => {
    const dbPath = join(dir, "data.db");
    writeFileSync(dbPath, Buffer.from("this is not a sqlite file"));
    const result = await checkIntegrity(dbPath, WASM);
    expect(result.ok).toBe(false);
  });

  it("quarantineCorruptDb renames to .corrupt-<ts>", async () => {
    const dbPath = join(dir, "data.db");
    writeFileSync(dbPath, Buffer.from([0, 1, 2]));
    const newPath = await quarantineCorruptDb(dbPath);
    expect(existsSync(dbPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
    expect(newPath).toMatch(/data\.db\.corrupt-\d+/);
  });
});
