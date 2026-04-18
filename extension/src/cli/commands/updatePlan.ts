import { existsSync } from "node:fs";

import { updatePlan as updatePlanWrite } from "../../panels/writes/planWrites";
import type { Command } from "./types";

export const updatePlan: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as {
    id?: unknown;
    name?: unknown;
    filePath?: unknown;
  };

  if (!Number.isInteger(args.id)) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "id must be integer",
    };
  }

  const update: { name?: string; filePath?: string | null } = {};

  if ("name" in args && args.name !== undefined) {
    if (typeof args.name !== "string" || args.name.length === 0) {
      return {
        ok: false,
        error: "invalid_args",
        detail: "name must be non-empty string",
      };
    }
    update.name = args.name;
  }

  if ("filePath" in args && args.filePath !== undefined) {
    if (args.filePath === null) {
      update.filePath = null;
    } else if (typeof args.filePath === "string") {
      update.filePath = args.filePath;
    } else {
      return {
        ok: false,
        error: "invalid_args",
        detail: "filePath must be string|null",
      };
    }
  }

  if (Object.keys(update).length === 0) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "at least one of name|filePath required",
    };
  }

  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const id = args.id as number;

  try {
    await updatePlanWrite(paths.dbPath, { id, ...update });
    return { ok: true, id };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("plan not found")) {
      return { ok: false, error: "not_found", detail: msg };
    }
    return { ok: false, error: "unexpected", detail: msg };
  }
};
