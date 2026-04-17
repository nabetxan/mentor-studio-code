import { existsSync } from "node:fs";

import { insertQuestion } from "./recordAnswer/insert";
import { updateQuestion } from "./recordAnswer/update";
import type { Command } from "./types";

export const recordAnswer: Command = async (rawArgs, paths) => {
  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  if (typeof args.id === "number") {
    return updateQuestion(args, paths);
  }
  return insertQuestion(args, paths);
};
