import { existsSync } from "node:fs";

import { InvariantViolationError } from "../../db";
import { activateTask as activateTaskWrite } from "../../panels/writes/taskWrites";
import type { Command } from "./types";

export const activateTask: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as { id?: unknown };

  if (!Number.isInteger(args.id)) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "id must be integer",
    };
  }

  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const id = args.id as number;

  try {
    await activateTaskWrite(paths.dbPath, { id }, paths.wasmPath);
    return { ok: true, id, active: true };
  } catch (e) {
    if (e instanceof InvariantViolationError) {
      return { ok: false, error: "invariant_violation", detail: e.message };
    }
    const msg = (e as Error).message;
    if (msg.startsWith("task not found")) {
      return { ok: false, error: "not_found", detail: msg };
    }
    return { ok: false, error: "unexpected", detail: msg };
  }
};
