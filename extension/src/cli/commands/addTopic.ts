import { existsSync } from "node:fs";

import { withWriteTransaction } from "../../db";
import type { Command } from "./types";

export const addTopic: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as { label?: unknown };
  if (typeof args.label !== "string" || args.label.length === 0) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "label must be non-empty string",
    };
  }
  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const label = args.label;
  const id = await withWriteTransaction(
    paths.dbPath,
    { purpose: "normal" },
    (db) => {
      const stmt = db.prepare("INSERT INTO topics(label) VALUES (?)");
      try {
        stmt.run([label]);
      } finally {
        stmt.free();
      }
      const r = db.exec("SELECT last_insert_rowid()");
      return Number(r[0].values[0][0]);
    },
  );

  return { ok: true, id, label };
};
