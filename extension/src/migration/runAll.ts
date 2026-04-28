import { existsSync } from "node:fs";
import { derivePaths, type DerivedPaths } from "../utils/derivePaths";
import { ensureWorkspaceId } from "../utils/workspaceId";
import { migrate } from "./migrate";
import { shouldMigrate, shouldMigrateV2 } from "./shouldMigrate";
import { migrateToV2 } from "./v2ProfileAppState";
import { shouldMigrateV3 } from "./v3ExternalDb";

export interface RunMigrationsInput {
  workspaceRoot: string;
  wasmPath: string;
}

export type MigrationStatus =
  /** Setup has never run (no `.mentor/config.json`). */
  | "noConfig"
  /** v3 (DB relocation) is required; activation must defer to user-triggered Setup. */
  | "needsMigration"
  /** Workspace is fully migrated; safe to register features. */
  | "ok";

export interface RunMigrationsResult {
  status: MigrationStatus;
  /** Set only when status === "ok". */
  workspaceId: string | null;
  paths: DerivedPaths;
}

export async function runMigrationsForActivation(
  input: RunMigrationsInput,
): Promise<RunMigrationsResult> {
  const pre = derivePaths({
    workspaceRoot: input.workspaceRoot,
    workspaceId: null,
  });
  if (!existsSync(pre.configPath)) {
    return { status: "noConfig", workspaceId: null, paths: pre };
  }

  // Legacy JSON → v1 DB schema. v3 may not have run yet, so this still
  // operates against the legacy in-workspace path. Same for v2 below.
  if (shouldMigrate(pre.mentorRoot)) {
    const result = await migrate(pre.mentorRoot, input.wasmPath);
    if (!result.ok) {
      throw new Error(
        `v1 migration failed: ${result.error}${
          result.detail ? ` (${result.detail})` : ""
        }`,
      );
    }
  }

  if (
    existsSync(pre.legacyInWorkspaceDbPath) &&
    (await shouldMigrateV2(pre.mentorRoot, input.wasmPath))
  ) {
    const result = await migrateToV2(pre.mentorRoot, input.wasmPath);
    if (!result.ok) {
      throw new Error(
        `v2 migration failed: ${result.error}${
          result.detail ? ` (${result.detail})` : ""
        }`,
      );
    }
  }

  // v3 (file relocation) is detected here but executed by Setup. Detection only
  // requires the legacy file path — no workspaceId needed. Returning
  // needsMigration short-circuits feature wiring in extension.ts so the user
  // is prompted to run Setup before the file watcher / commands touch the DB.
  if (shouldMigrateV3(pre.legacyInWorkspaceDbPath)) {
    return { status: "needsMigration", workspaceId: null, paths: pre };
  }

  // No v3 needed — safe to ensure workspaceId and return external paths.
  const workspaceId = await ensureWorkspaceId(pre.configPath);
  const paths = derivePaths({
    workspaceRoot: input.workspaceRoot,
    workspaceId,
  });
  return { status: "ok", workspaceId, paths };
}
