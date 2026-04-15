import { existsSync, readFileSync } from "node:fs";

import { loadSqlJs } from "../../db";
import type { Command } from "./types";

export const listPlans: Command = async (rawArgs, paths) => {
  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const args = (rawArgs ?? {}) as {
    includeRemoved?: boolean;
    includeCompleted?: boolean;
  };
  const includeRemoved = args.includeRemoved ? 1 : 0;
  const includeCompleted = args.includeCompleted ? 1 : 0;

  try {
    const SQL = await loadSqlJs(paths.wasmPath);
    const db = new SQL.Database(readFileSync(paths.dbPath));
    try {
      const res = db.exec(
        `SELECT p.id, p.name, p.filePath, p.status, p.sortOrder,
                (SELECT COUNT(*) FROM tasks WHERE planId = p.id) AS taskCount
         FROM plans p
         WHERE 1=1
           AND (? = 1 OR p.status != 'removed')
           AND (? = 1 OR p.status != 'completed')
         ORDER BY p.sortOrder ASC`,
        [includeRemoved, includeCompleted],
      );
      const plans = res[0]
        ? res[0].values.map((row) => ({
            id: Number(row[0]),
            name: String(row[1]),
            filePath: row[2] === null ? null : String(row[2]),
            status: String(row[3]),
            sortOrder: Number(row[4]),
            taskCount: Number(row[5]),
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
