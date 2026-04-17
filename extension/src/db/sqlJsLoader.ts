import { existsSync } from "node:fs";
import initSqlJs, { type SqlJsStatic } from "sql.js";

let cached: SqlJsStatic | undefined;
let cachedPath: string | undefined;

export async function loadSqlJs(wasmPath: string): Promise<SqlJsStatic> {
  if (cached && cachedPath === wasmPath) return cached;
  if (!existsSync(wasmPath)) {
    throw new Error(`sql.js wasm not found at: ${wasmPath}`);
  }
  cached = await initSqlJs({ locateFile: () => wasmPath });
  cachedPath = wasmPath;
  return cached;
}

export function __resetSqlJsCache(): void {
  cached = undefined;
  cachedPath = undefined;
}
