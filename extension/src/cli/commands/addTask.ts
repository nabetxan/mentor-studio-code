import { existsSync } from "node:fs";

import { createTask } from "../../panels/writes/taskWrites";
import type { Command } from "./types";

export const addTask: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as {
    planId?: unknown;
    name?: unknown;
  };

  if (typeof args.planId !== "number" || !Number.isInteger(args.planId)) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "planId must be an integer",
    };
  }

  if (typeof args.name !== "string" || args.name.length === 0) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "name must be non-empty string",
    };
  }

  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const planId = args.planId;
  const name = args.name;

  try {
    const { id, activated } = await createTask(paths.dbPath, {
      planId,
      name,
    });
    return { ok: true, id, activated };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("plan not found")) {
      return { ok: false, error: "plan_not_found", detail: msg };
    }
    return { ok: false, error: "unexpected", detail: msg };
  }
};
