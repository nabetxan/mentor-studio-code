import { existsSync, readFileSync } from "node:fs";

import { atomicWriteFile } from "../../db";
import type { Command } from "./types";

const STRING_KEYS = ["experience", "level", "mentor_style"] as const;
const ARRAY_KEYS = ["interests", "weak_areas"] as const;

function defaultProgress(): Record<string, unknown> {
  return {
    current_task: null,
    current_step: null,
    resume_context: null,
    learner_profile: {},
  };
}

export const updateProfile: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  for (const k of STRING_KEYS) {
    if (k in args && typeof args[k] !== "string") {
      return {
        ok: false,
        error: "invalid_args",
        detail: `${k} must be string`,
      };
    }
  }
  for (const k of ARRAY_KEYS) {
    if (k in args) {
      const v = args[k];
      if (!Array.isArray(v) || !v.every((e) => typeof e === "string")) {
        return {
          ok: false,
          error: "invalid_args",
          detail: `${k} must be string[]`,
        };
      }
    }
  }

  const progress = existsSync(paths.progressPath)
    ? (JSON.parse(readFileSync(paths.progressPath, "utf-8")) as Record<
        string,
        unknown
      >)
    : defaultProgress();

  const existing =
    (progress.learner_profile as Record<string, unknown> | undefined) ?? {};
  const profile: Record<string, unknown> = { ...existing };
  for (const k of [...STRING_KEYS, ...ARRAY_KEYS]) {
    if (k in args) profile[k] = args[k];
  }
  profile.last_updated = new Date().toISOString();
  progress.learner_profile = profile;

  try {
    await atomicWriteFile(
      paths.progressPath,
      Buffer.from(JSON.stringify(progress, null, 2), "utf-8"),
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
