import { existsSync, readFileSync } from "node:fs";

import { loadSqlJs } from "../../db";
import type { Command } from "./types";

export const listPlans: Command = async (_args, paths) => {
  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  try {
    const SQL = await loadSqlJs(paths.wasmPath);
    const db = new SQL.Database(readFileSync(paths.dbPath));
    try {
      const res = db.exec(
        "SELECT id, name, filePath, status, sortOrder FROM plans ORDER BY sortOrder ASC",
      );
      const plans = res[0]
        ? res[0].values.map((row) => ({
            id: Number(row[0]),
            name: String(row[1]),
            filePath: row[2] === null ? null : String(row[2]),
            status: String(row[3]),
            sortOrder: Number(row[4]),
          }))
        : [];
      return { ok: true, plans };
    } finally {
      db.close();
    }
  } catch (e) {
    return { ok: false, error: "unexpected", detail: (e as Error).message };
  }
};
