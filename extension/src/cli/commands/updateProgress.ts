import { existsSync, readFileSync } from "node:fs";

import { atomicWriteFile } from "../../db";
import type { Command } from "./types";

const MUTABLE_KEYS = ["current_step", "resume_context"] as const;

function defaultProgress(): Record<string, unknown> {
  return {
    current_task: null,
    current_step: null,
    resume_context: null,
    learner_profile: {},
  };
}

export const updateProgress: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  let hasKnownKey = false;
  for (const k of MUTABLE_KEYS) {
    if (k in args) {
      hasKnownKey = true;
      if (args[k] !== null && typeof args[k] !== "string") {
        return {
          ok: false,
          error: "invalid_args",
          detail: `${k} must be string|null`,
        };
      }
    }
  }

  if (!hasKnownKey) return { ok: true };

  let progress: Record<string, unknown>;
  if (existsSync(paths.progressPath)) {
    try {
      progress = JSON.parse(
        readFileSync(paths.progressPath, "utf-8"),
      ) as Record<string, unknown>;
    } catch (e) {
      return {
        ok: false,
        error: "invalid_json",
        detail: (e as Error).message,
      };
    }
  } else {
    progress = defaultProgress();
  }

  for (const k of MUTABLE_KEYS) {
    if (k in args) progress[k] = args[k];
  }

  try {
    await atomicWriteFile(
      paths.progressPath,
      Buffer.from(`${JSON.stringify(progress, null, 2)}\n`, "utf-8"),
    );
  } catch (e) {
    return {
      ok: false,
      error: "progress_write_failed",
      recoverable: true,
      detail: (e as Error).message,
    };
  }

  return { ok: true };
};
