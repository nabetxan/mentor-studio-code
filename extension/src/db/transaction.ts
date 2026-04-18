import { readFile } from "node:fs/promises";
import type { Database } from "sql.js";
import { atomicWriteFile } from "./atomicWrite";
import { acquireLock, releaseLock, type LockPurpose } from "./lock";
import { loadSqlJs } from "./sqlJsLoader";

export interface TxOptions {
  /** Omit when the CLI bundle has wasm embedded; required for extension-side use. */
  wasmPath?: string;
  purpose: LockPurpose;
  lockTimeoutMs?: number;
}

export async function withWriteTransaction<T>(
  dbPath: string,
  opts: TxOptions,
  work: (db: Database) => T | Promise<T>,
): Promise<T> {
  const lock = await acquireLock(dbPath, {
    purpose: opts.purpose,
    timeoutMs: opts.lockTimeoutMs,
  });
  try {
    const SQL = await loadSqlJs(opts.wasmPath);
    const bytes = await readFile(dbPath);
    const db = new SQL.Database(bytes);
    try {
      db.exec("PRAGMA foreign_keys = ON");
      db.exec("BEGIN");
      let result: T;
      try {
        result = await work(db);
        db.exec("COMMIT");
      } catch (workErr) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // Swallow ROLLBACK failure so the original error is not masked.
        }
        throw workErr;
      }
      const exported = Buffer.from(db.export());
      await atomicWriteFile(dbPath, exported);
      return result;
    } finally {
      db.close();
    }
  } finally {
    await releaseLock(lock);
  }
}
