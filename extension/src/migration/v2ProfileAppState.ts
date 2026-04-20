import { existsSync, readFileSync } from "node:fs";
import { copyFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

import {
  acquireLock,
  atomicWriteFile,
  loadSqlJs,
  releaseLock,
  SCHEMA_DDL,
} from "../db";

const V2_USER_VERSION = 2;

export type V2Ok = { ok: true; skipped?: boolean };
export type V2Fail = { ok: false; error: string; detail?: string };

function toStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : [];
}

function asString(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

async function readProgress(
  progressPath: string,
): Promise<{ ok: true; value: Record<string, unknown> } | V2Fail> {
  if (!existsSync(progressPath)) return { ok: true, value: {} };
  let raw: string;
  try {
    raw = await readFile(progressPath, "utf-8");
  } catch (e) {
    return {
      ok: false,
      error: "progress_read_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: true, value: {} };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      error: "invalid_progress_json",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function migrateToV2(
  mentorDir: string,
  wasmPath: string,
): Promise<V2Ok | V2Fail> {
  const dbPath = join(mentorDir, "data.db");
  const progressPath = join(mentorDir, "progress.json");
  if (!existsSync(dbPath)) {
    return { ok: false, error: "db_missing" };
  }

  const lock = await acquireLock(dbPath, { purpose: "migration" });
  try {
    const SQL = await loadSqlJs(wasmPath);
    const db = new SQL.Database(readFileSync(dbPath));
    try {
      const version = Number(
        db.exec("PRAGMA user_version")[0].values[0][0] ?? 0,
      );
      if (version >= V2_USER_VERSION) {
        return { ok: true, skipped: true };
      }

      // Phase 1: apply the v2 schema unconditionally. Don't bump user_version
      // yet — that signals "data is migrated", which we can't claim until the
      // JSON import finishes. If later phases fail, the DB is still v2-shaped
      // so queries against learner_profile/app_state don't throw, and the next
      // activation will retry (user_version still < V2).
      db.exec("BEGIN IMMEDIATE");
      try {
        db.exec(SCHEMA_DDL);
        db.exec("COMMIT");
      } catch (e) {
        try {
          db.exec("ROLLBACK");
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          error: "schema_failed",
          detail: e instanceof Error ? e.message : String(e),
        };
      }
      await atomicWriteFile(dbPath, Buffer.from(db.export()));

      // Phase 2: read progress.json, import data, and bump user_version.
      const progressResult = await readProgress(progressPath);
      if (!progressResult.ok) return progressResult;
      const progress = progressResult.value;
      const profileRaw =
        (progress.learner_profile as Record<string, unknown> | undefined) ?? {};
      const resumeContext =
        typeof progress.resume_context === "string"
          ? progress.resume_context
          : null;

      db.exec("BEGIN IMMEDIATE");
      try {
        const legacyLastUpdated =
          typeof profileRaw.last_updated === "string"
            ? profileRaw.last_updated
            : null;
        if (legacyLastUpdated !== null) {
          const insertProfile = db.prepare(
            `INSERT INTO learner_profile (experience, level, interests, weakAreas, mentorStyle, lastUpdated)
             VALUES (?, ?, ?, ?, ?, ?)`,
          );
          try {
            insertProfile.run([
              asString(profileRaw.experience),
              asString(profileRaw.level),
              JSON.stringify(toStringArray(profileRaw.interests)),
              JSON.stringify(toStringArray(profileRaw.weak_areas)),
              asString(profileRaw.mentor_style),
              legacyLastUpdated,
            ]);
          } finally {
            insertProfile.free();
          }
        }

        const upsertState = db.prepare(
          `INSERT INTO app_state (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        );
        try {
          upsertState.run(["resume_context", resumeContext]);
        } finally {
          upsertState.free();
        }

        db.exec(`PRAGMA user_version = ${V2_USER_VERSION}`);
        db.exec("COMMIT");
      } catch (e) {
        try {
          db.exec("ROLLBACK");
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          error: "migration_failed",
          detail: e instanceof Error ? e.message : String(e),
        };
      }

      await atomicWriteFile(dbPath, Buffer.from(db.export()));
    } finally {
      db.close();
    }

    if (existsSync(progressPath)) {
      try {
        await copyFile(progressPath, `${progressPath}.bak`);
        await unlink(progressPath);
      } catch (e) {
        return {
          ok: false,
          error: "progress_cleanup_failed",
          detail: e instanceof Error ? e.message : String(e),
        };
      }
    }

    return { ok: true };
  } finally {
    await releaseLock(lock);
  }
}

export type OrphanCleanupResult =
  | { ok: true; cleaned: boolean }
  | { ok: false; error: string; detail?: string };

export async function cleanupOrphanProgressJson(
  mentorDir: string,
  wasmPath: string,
): Promise<OrphanCleanupResult> {
  const dbPath = join(mentorDir, "data.db");
  const progressPath = join(mentorDir, "progress.json");
  if (!existsSync(dbPath) || !existsSync(progressPath)) {
    return { ok: true, cleaned: false };
  }

  let version: number;
  try {
    const SQL = await loadSqlJs(wasmPath);
    const db = new SQL.Database(readFileSync(dbPath));
    try {
      version = Number(db.exec("PRAGMA user_version")[0].values[0][0] ?? 0);
    } finally {
      db.close();
    }
  } catch (e) {
    return {
      ok: false,
      error: "db_read_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
  if (version < V2_USER_VERSION) return { ok: true, cleaned: false };

  try {
    await copyFile(progressPath, `${progressPath}.bak`);
    await unlink(progressPath);
    return { ok: true, cleaned: true };
  } catch (e) {
    return {
      ok: false,
      error: "progress_cleanup_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
