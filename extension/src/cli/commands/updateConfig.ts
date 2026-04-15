import { existsSync, readFileSync } from "node:fs";

import { atomicWriteFile } from "../../db";
import type { Command } from "./types";

export const updateConfig: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  if (!existsSync(paths.configPath)) {
    return { ok: false, error: "config_missing" };
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(readFileSync(paths.configPath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch (e) {
    return { ok: false, error: "invalid_json", detail: (e as Error).message };
  }

  if ("mentorFiles" in args) {
    const mf = args.mentorFiles;
    if (mf === null || typeof mf !== "object" || Array.isArray(mf)) {
      return {
        ok: false,
        error: "invalid_args",
        detail: "mentorFiles must be object",
      };
    }
    const incoming = mf as Record<string, unknown>;
    if ("plan" in incoming) {
      return {
        ok: false,
        error: "invalid_args",
        detail: "mentorFiles.plan is managed by Plan Panel, not CLI",
      };
    }
    for (const k of ["spec"] as const) {
      if (k in incoming) {
        const v = incoming[k];
        if (v !== null && typeof v !== "string") {
          return {
            ok: false,
            error: "invalid_args",
            detail: `mentorFiles.${k} must be string|null`,
          };
        }
      }
    }
    const existing =
      (config.mentorFiles as Record<string, unknown> | undefined) ?? {};
    config.mentorFiles = { ...existing, ...incoming };
  }

  try {
    await atomicWriteFile(
      paths.configPath,
      Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf-8"),
    );
  } catch (e) {
    return {
      ok: false,
      error: "config_write_failed",
      recoverable: true,
      detail: (e as Error).message,
    };
  }

  return { ok: true };
};
