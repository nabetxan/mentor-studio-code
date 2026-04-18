import { existsSync, readFileSync } from "node:fs";

import { loadSqlJs } from "../../db";
import type { Command } from "./types";

export const listTopics: Command = async (_args, paths) => {
  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };
  const SQL = await loadSqlJs();
  const db = new SQL.Database(readFileSync(paths.dbPath));
  try {
    const res = db.exec("SELECT id, label FROM topics ORDER BY id ASC");
    const topics = res[0]
      ? res[0].values.map((row) => ({
          id: Number(row[0]),
          label: String(row[1]),
        }))
      : [];
    return { ok: true, topics };
  } finally {
    db.close();
  }
};
