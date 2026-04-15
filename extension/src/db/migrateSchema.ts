import { readFile } from "node:fs/promises";
import { atomicWriteFile } from "./atomicWrite";
import { acquireLock, releaseLock } from "./lock";
import { SCHEMA_VERSION } from "./schema";
import { loadSqlJs } from "./sqlJsLoader";

export interface MigrateOptions {
  wasmPath: string;
}

/**
 * Migrate an existing DB to the current SCHEMA_VERSION.
 * Currently handles: v1 → v2 (adds 'backlog' and 'removed' to plans.status CHECK).
 *
 * No-op if user_version is already >= SCHEMA_VERSION.
 */
export async function migrateSchema(
  dbPath: string,
  opts: MigrateOptions,
): Promise<void> {
  const lock = await acquireLock(dbPath, { purpose: "migration" });
  try {
    const SQL = await loadSqlJs(opts.wasmPath);
    const bytes = await readFile(dbPath);
    const db = new SQL.Database(bytes);
    try {
      const userVersion = db.exec("PRAGMA user_version")[0]
        .values[0][0] as number;
      if (userVersion >= SCHEMA_VERSION) {
        return;
      }

      // Disable FK enforcement during schema migration so existing FK references
      // to the plans table don't block the DROP TABLE step.
      db.exec("PRAGMA foreign_keys = OFF");
      try {
        if (userVersion < 2) {
          migrateV1ToV2(db);
        }
      } finally {
        db.exec("PRAGMA foreign_keys = ON");
      }

      const exported = Buffer.from(db.export());
      await atomicWriteFile(dbPath, exported);
    } finally {
      db.close();
    }
  } finally {
    await releaseLock(lock);
  }
}

function migrateV1ToV2(db: import("sql.js").Database): void {
  db.exec("BEGIN TRANSACTION");
  try {
    // 1. Create replacement plans table with updated CHECK constraint
    db.exec(`
      CREATE TABLE plans_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filePath TEXT,
        status TEXT NOT NULL CHECK (status IN ('active','queued','completed','paused','backlog','removed')),
        sortOrder INTEGER NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);

    // 2. Copy all existing rows
    db.exec(`INSERT INTO plans_new SELECT * FROM plans`);

    // 3. Drop old table
    db.exec(`DROP TABLE plans`);

    // 4. Rename new table
    db.exec(`ALTER TABLE plans_new RENAME TO plans`);

    // 5. Recreate indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_plans_sort ON plans(sortOrder)`);
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_plans_active ON plans(status) WHERE status = 'active'`,
    );

    // 6. Bump schema version
    db.exec(`PRAGMA user_version = 2`);

    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Swallow rollback failure to preserve original error
    }
    throw err;
  }
}
