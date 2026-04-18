import { existsSync } from "node:fs";
import initSqlJs, { type SqlJsStatic } from "sql.js";

let cached: SqlJsStatic | undefined;
let cachedKey: string | undefined;
let embedded: Uint8Array | undefined;

const EMBEDDED_KEY = "<embedded>";

export function setEmbeddedWasm(bytes: Uint8Array): void {
  embedded = bytes;
}

export async function loadSqlJs(wasmPath?: string): Promise<SqlJsStatic> {
  if (embedded) {
    if (cached && cachedKey === EMBEDDED_KEY) return cached;
    // emscripten accepts Uint8Array at runtime; its type says ArrayBuffer.
    cached = await initSqlJs({
      wasmBinary: embedded as unknown as ArrayBuffer,
    });
    cachedKey = EMBEDDED_KEY;
    return cached;
  }
  if (!wasmPath) {
    throw new Error("sql.js wasm source not provided");
  }
  if (cached && cachedKey === wasmPath) return cached;
  if (!existsSync(wasmPath)) {
    throw new Error(`sql.js wasm not found at: ${wasmPath}`);
  }
  cached = await initSqlJs({ locateFile: () => wasmPath });
  cachedKey = wasmPath;
  return cached;
}

export function __resetSqlJsCache(): void {
  cached = undefined;
  cachedKey = undefined;
  embedded = undefined;
}
