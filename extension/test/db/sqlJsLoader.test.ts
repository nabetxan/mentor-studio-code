import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  __resetSqlJsCache,
  loadSqlJs,
  setEmbeddedWasm,
} from "../../src/db/sqlJsLoader";

const WASM_PATH = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");
const WASM_BYTES = readFileSync(WASM_PATH);

describe("loadSqlJs", () => {
  afterEach(() => {
    // Restore the globally-registered embedded wasm after each test so
    // other suites that rely on it (via test/setup.ts) aren't affected.
    __resetSqlJsCache();
    setEmbeddedWasm(WASM_BYTES);
  });

  it("returns an initialized SQL namespace from embedded bytes", async () => {
    const SQL = await loadSqlJs();
    const db = new SQL.Database();
    db.exec("CREATE TABLE t (x)");
    expect(db.exec("SELECT name FROM sqlite_master")[0].values[0][0]).toBe("t");
  });

  it("caches the SQL namespace across calls", async () => {
    const a = await loadSqlJs();
    const b = await loadSqlJs();
    expect(a).toBe(b);
  });

  it("falls back to wasmPath when no embedded bytes are registered", async () => {
    __resetSqlJsCache();
    const SQL = await loadSqlJs(WASM_PATH);
    const db = new SQL.Database();
    db.exec("CREATE TABLE t (x)");
    expect(db.exec("SELECT name FROM sqlite_master")[0].values[0][0]).toBe("t");
  });

  it("throws a clear error when neither embedded bytes nor a valid path are provided", async () => {
    __resetSqlJsCache();
    await expect(loadSqlJs()).rejects.toThrow(/wasm/i);
    await expect(loadSqlJs("/nonexistent/path/sql-wasm.wasm")).rejects.toThrow(
      /wasm/i,
    );
  });
});
