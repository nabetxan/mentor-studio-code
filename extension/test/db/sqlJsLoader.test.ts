import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSqlJs } from "../../src/db/sqlJsLoader";

describe("loadSqlJs", () => {
  const wasmPath = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

  it("returns an initialized SQL namespace", async () => {
    const SQL = await loadSqlJs(wasmPath);
    const db = new SQL.Database();
    db.exec("CREATE TABLE t (x)");
    expect(db.exec("SELECT name FROM sqlite_master")[0].values[0][0]).toBe("t");
  });

  it("caches the SQL namespace across calls", async () => {
    const a = await loadSqlJs(wasmPath);
    const b = await loadSqlJs(wasmPath);
    expect(a).toBe(b);
  });

  it("throws a clear error when wasm path is missing", async () => {
    await expect(loadSqlJs("/nonexistent/path/sql-wasm.wasm")).rejects.toThrow(
      /wasm/i,
    );
  });
});
