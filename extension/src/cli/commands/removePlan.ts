import { existsSync } from "node:fs";

import { removePlan as removePlanWrite } from "../../panels/writes/planWrites";
import type { Command } from "./types";

export const removePlan: Command = async (rawArgs, paths) => {
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
    await removePlanWrite(paths.dbPath, { id });
    return { ok: true, id };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("plan not found")) {
      return { ok: false, error: "not_found", detail: msg };
    }
    return { ok: false, error: "unexpected", detail: msg };
  }
};
