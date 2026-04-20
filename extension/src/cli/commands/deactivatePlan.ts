import { existsSync } from "node:fs";

import { deactivatePlan as deactivatePlanWrite } from "../../panels/writes/planWrites";
import type { Command } from "./types";

export const deactivatePlan: Command = async (rawArgs, paths) => {
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
    await deactivatePlanWrite(paths.dbPath, { id });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: "unexpected", detail: (e as Error).message };
  }
};
