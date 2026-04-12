import { existsSync } from "node:fs";
import { atomicWriteFile } from "./atomicWrite";
import { acquireLock, releaseLock } from "./lock";
import { SCHEMA_DDL, SCHEMA_VERSION } from "./schema";
import { loadSqlJs } from "./sqlJsLoader";

export interface BootstrapOptions {
  wasmPath: string;
  topics: { key: string; label: string }[];
}

export async function bootstrapDb(
  dbPath: string,
  opts: BootstrapOptions,
): Promise<void> {
  if (existsSync(dbPath)) {
    throw new Error(`DB already exists at ${dbPath}`);
  }
  const lock = await acquireLock(dbPath, { purpose: "migration" });
  try {
    if (existsSync(dbPath)) {
      throw new Error(
        `DB already exists at ${dbPath} (created by concurrent bootstrap)`,
      );
    }
    const SQL = await loadSqlJs(opts.wasmPath);
    const db = new SQL.Database();
    try {
      db.exec("PRAGMA foreign_keys = ON");
      db.exec("BEGIN");
      try {
        db.exec(SCHEMA_DDL);
        if (opts.topics.length > 0) {
          const stmt = db.prepare("INSERT INTO topics(key,label) VALUES (?,?)");
          try {
            for (const t of opts.topics) stmt.run([t.key, t.label]);
          } finally {
            stmt.free();
          }
        }
        db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        db.exec("COMMIT");
      } catch (workErr) {
        try {
          db.exec("ROLLBACK");
        } catch {
          /* swallow to preserve original error */
        }
        throw workErr;
      }
      const bytes = Buffer.from(db.export());
      await atomicWriteFile(dbPath, bytes);
    } finally {
      db.close();
    }
  } finally {
    await releaseLock(lock);
  }
}
