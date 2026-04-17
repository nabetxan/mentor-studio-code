import { existsSync } from "node:fs";

import { deletePlan as deletePlanWrite } from "../../panels/writes/planWrites";
import type { Command } from "./types";

export const deletePlan: Command = async (rawArgs, paths) => {
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
    await deletePlanWrite(paths.dbPath, { id }, paths.wasmPath);
    return { ok: true, id };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("plan not found")) {
      return { ok: false, error: "not_found", detail: msg };
    }
    if (msg.startsWith("plan has dependents")) {
      return { ok: false, error: "invalid_state", detail: msg };
    }
    return { ok: false, error: "unexpected", detail: msg };
  }
};
