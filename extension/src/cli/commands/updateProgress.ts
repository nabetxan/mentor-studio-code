import { withWriteTransaction } from "../../db";
import type { Command } from "./types";

const MUTABLE_KEYS = ["resume_context"] as const;

export const updateProgress: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  let hasKnownKey = false;
  for (const k of MUTABLE_KEYS) {
    if (k in args) {
      hasKnownKey = true;
      if (args[k] !== null && typeof args[k] !== "string") {
        return {
          ok: false,
          error: "invalid_args",
          detail: `${k} must be string|null`,
        };
      }
    }
  }
  if (!hasKnownKey) return { ok: true };

  try {
    await withWriteTransaction(
      paths.dbPath,
      { purpose: "normal" },
      (db) => {
        const stmt = db.prepare(
          `INSERT INTO app_state (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        );
        try {
          for (const k of MUTABLE_KEYS) {
            if (!(k in args)) continue;
            stmt.run([k, args[k] as string | null]);
          }
        } finally {
          stmt.free();
        }
      },
    );
  } catch (e) {
    return {
      ok: false,
      error: "db_write_failed",
      recoverable: true,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  return { ok: true };
};
