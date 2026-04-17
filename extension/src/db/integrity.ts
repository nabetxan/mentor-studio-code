import { readFile, rename } from "node:fs/promises";
import { loadSqlJs } from "./sqlJsLoader";

export type IntegrityResult = { ok: true } | { ok: false; reason: string };

export async function checkIntegrity(
  dbPath: string,
  wasmPath: string,
): Promise<IntegrityResult> {
  try {
    const SQL = await loadSqlJs(wasmPath);
    const bytes = await readFile(dbPath);
    const db = new SQL.Database(bytes);
    try {
      const result = db.exec("PRAGMA integrity_check");
      const rows = result[0]?.values ?? [];
      const badRow = rows.find((r: unknown[]) => String(r[0]) !== "ok");
      if (rows.length > 0 && !badRow) return { ok: true };
      return { ok: false, reason: String(badRow?.[0] ?? "unknown") };
    } finally {
      db.close();
    }
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function quarantineCorruptDb(dbPath: string): Promise<string> {
  const ts = Date.now();
  const target = `${dbPath}.corrupt-${ts}`;
  await rename(dbPath, target);
  return target;
}
