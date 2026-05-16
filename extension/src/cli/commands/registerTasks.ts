import { existsSync } from "node:fs";

import { registerTasks as registerTasksWrite } from "../../panels/writes/taskWrites";
import type { Command } from "./types";

export const registerTasks: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as {
    planId?: unknown;
    names?: unknown;
  };

  if (typeof args.planId !== "number" || !Number.isInteger(args.planId)) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "planId must be an integer",
    };
  }

  if (!Array.isArray(args.names) || args.names.length === 0) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "names must be a non-empty array",
    };
  }

  if (
    args.names.some(
      (name) => typeof name !== "string" || name.trim().length === 0,
    )
  ) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "names must contain only non-empty strings after trimming",
    };
  }

  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const names = args.names.map((name) => name.trim());

  try {
    const result = await registerTasksWrite(paths.dbPath, {
      planId: args.planId,
      names,
    });
    return {
      ok: true,
      tasks: result.tasks,
      activatedTask: result.activatedTask,
    };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("plan not found")) {
      return { ok: false, error: "plan_not_found", detail: msg };
    }
    if (msg.startsWith("tasks already exist")) {
      return { ok: false, error: "tasks_already_exist", detail: msg };
    }
    return { ok: false, error: "unexpected", detail: msg };
  }
};
