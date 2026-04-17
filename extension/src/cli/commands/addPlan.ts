import { existsSync } from "node:fs";

import { createPlan } from "../../panels/writes/planWrites";
import type { Command } from "./types";

export const addPlan: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as {
    name?: unknown;
    filePath?: unknown;
  };

  if (typeof args.name !== "string" || args.name.length === 0) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "name must be non-empty string",
    };
  }

  let filePath: string | null = null;
  if ("filePath" in args && args.filePath !== undefined) {
    if (args.filePath === null) {
      filePath = null;
    } else if (typeof args.filePath === "string") {
      filePath = args.filePath;
    } else {
      return {
        ok: false,
        error: "invalid_args",
        detail: "filePath must be string|null",
      };
    }
  }

  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const name = args.name;

  try {
    const { id } = await createPlan(
      paths.dbPath,
      { name, filePath },
      paths.wasmPath,
    );
    return { ok: true, id, name, filePath };
  } catch (e) {
    return { ok: false, error: "unexpected", detail: (e as Error).message };
  }
};
