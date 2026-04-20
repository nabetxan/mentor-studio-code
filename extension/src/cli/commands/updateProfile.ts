import { withWriteTransaction } from "../../db";
import type { Command } from "./types";

const STRING_KEYS = ["experience", "level", "mentor_style"] as const;
const ARRAY_KEYS = ["interests", "weak_areas"] as const;

type StringKey = (typeof STRING_KEYS)[number];
type ArrayKey = (typeof ARRAY_KEYS)[number];

interface Snapshot {
  experience: string;
  level: string;
  mentor_style: string;
  interests: string[];
  weak_areas: string[];
}

const EMPTY_SNAPSHOT: Snapshot = {
  experience: "",
  level: "",
  mentor_style: "",
  interests: [],
  weak_areas: [],
};

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

  try {
    await withWriteTransaction(
      paths.dbPath,
      { purpose: "normal" },
      (db) => {
        const latestRes = db.exec(
          `SELECT experience, level, interests, weakAreas, mentorStyle
           FROM learner_profile
           ORDER BY lastUpdated DESC, id DESC
           LIMIT 1`,
        )[0];

        const base: Snapshot =
          latestRes && latestRes.values.length > 0
            ? {
                experience: String(latestRes.values[0][0] ?? ""),
                level: String(latestRes.values[0][1] ?? ""),
                interests: JSON.parse(
                  String(latestRes.values[0][2] ?? "[]"),
                ) as string[],
                weak_areas: JSON.parse(
                  String(latestRes.values[0][3] ?? "[]"),
                ) as string[],
                mentor_style: String(latestRes.values[0][4] ?? ""),
              }
            : { ...EMPTY_SNAPSHOT };

        const next: Snapshot = { ...base };
        for (const k of STRING_KEYS) {
          if (k in args) next[k as StringKey] = args[k] as string;
        }
        for (const k of ARRAY_KEYS) {
          if (k in args) next[k as ArrayKey] = args[k] as string[];
        }

        const stmt = db.prepare(
          `INSERT INTO learner_profile
             (experience, level, interests, weakAreas, mentorStyle, lastUpdated)
           VALUES (?, ?, ?, ?, ?, ?)`,
        );
        try {
          stmt.run([
            next.experience,
            next.level,
            JSON.stringify(next.interests),
            JSON.stringify(next.weak_areas),
            next.mentor_style,
            new Date().toISOString(),
          ]);
        } finally {
          stmt.free();
        }
      },
    );
  } catch (e) {
    return {
      ok: false,
      error: "db_write_failed",
      recoverable: true,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  return { ok: true };
};
