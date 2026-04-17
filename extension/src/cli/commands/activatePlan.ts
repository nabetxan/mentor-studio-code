import { existsSync } from "node:fs";

import {
  activatePlan as activatePlanWrite,
  deactivatePlan as deactivatePlanWrite,
} from "../../panels/writes/planWrites";
import type { Command } from "./types";

export const activatePlan: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as {
    id?: unknown;
    deactivate?: unknown;
  };

  if (!Number.isInteger(args.id)) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "id must be integer",
    };
  }

  let deactivate = false;
  if ("deactivate" in args && args.deactivate !== undefined) {
    if (typeof args.deactivate !== "boolean") {
      return {
        ok: false,
        error: "invalid_args",
        detail: "deactivate must be boolean",
      };
    }
    deactivate = args.deactivate;
  }

  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const id = args.id as number;

  try {
    if (deactivate) {
      await deactivatePlanWrite(paths.dbPath, { id }, paths.wasmPath);
      return { ok: true, id, active: false };
    }
    await activatePlanWrite(paths.dbPath, { id }, paths.wasmPath);
    return { ok: true, id, active: true };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("plan not found")) {
      return { ok: false, error: "not_found", detail: msg };
    }
    return { ok: false, error: "unexpected", detail: msg };
  }
};
