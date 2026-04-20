import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSqlJs, SCHEMA_VERSION } from "../db";

export function shouldMigrate(mentorDir: string): boolean {
  const historyPath = join(mentorDir, "question-history.json");
  const dbPath = join(mentorDir, "data.db");
  if (!existsSync(historyPath)) return false;
  if (existsSync(dbPath)) return false;
  try {
    const raw: unknown = JSON.parse(readFileSync(historyPath, "utf-8"));
    if (Array.isArray(raw)) return raw.length > 0;
    if (raw && typeof raw === "object") {
      const h = (raw as { history?: unknown }).history;
      return Array.isArray(h) && h.length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

export async function shouldMigrateV2(
  mentorDir: string,
  wasmPath: string,
): Promise<boolean> {
  const dbPath = join(mentorDir, "data.db");
  if (!existsSync(dbPath)) return false;
  try {
    const SQL = await loadSqlJs(wasmPath);
    const db = new SQL.Database(readFileSync(dbPath));
    try {
      const version = Number(
        db.exec("PRAGMA user_version")[0].values[0][0] ?? 0,
      );
      return version < SCHEMA_VERSION;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}
