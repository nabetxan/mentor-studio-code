import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { atomicWriteFile } from "../db/atomicWrite";

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * v3 = file relocation only (no schema delta).
 * Detection is purely file-based: if the legacy in-workspace DB still
 * exists, there is something to migrate or clean up.
 *
 * DO NOT bump SCHEMA_VERSION for v3. `shouldMigrateV2` reads SCHEMA_VERSION
 * as the *target* version (compares user_version < SCHEMA_VERSION), so any
 * bump re-fires the v2 profile/app_state migration on every activation —
 * which can corrupt or wipe profile data. v3 is intentionally schema-less.
 */
export function shouldMigrateV3(legacyInWorkspaceDbPath: string): boolean {
  return existsSync(legacyInWorkspaceDbPath);
}

async function uniqueRenameTarget(base: string): Promise<string> {
  if (!existsSync(base)) return base;
  for (let i = 1; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not find a unique rename target for ${base}`);
}

async function renameWithStamp(source: string): Promise<void> {
  if (!existsSync(source)) return;
  const target = await uniqueRenameTarget(`${source}.migrated-${todayStamp()}`);
  await rename(source, target);
}

export async function migrateToV3(
  legacyInWorkspaceDbPath: string,
  externalDbPath: string,
): Promise<void> {
  if (!existsSync(legacyInWorkspaceDbPath)) return;

  // Step 1: ensure external exists with the right bytes.
  // If external already exists (partial-failure recovery), preserve it —
  // do NOT overwrite, since the existing external bytes are authoritative.
  if (!existsSync(externalDbPath)) {
    await mkdir(dirname(externalDbPath), { recursive: true });
    const bytes = await readFile(legacyInWorkspaceDbPath);
    try {
      await atomicWriteFile(externalDbPath, bytes);
    } catch (err) {
      try {
        if (existsSync(externalDbPath)) await unlink(externalDbPath);
      } catch {
        // Ignore cleanup failures — the throw below is the user-visible error.
      }
      throw err;
    }
  }

  // Step 2: rename legacy + .bak sidecar (best-effort; missing files skipped).
  // .lock is intentionally NOT touched — the orchestrator may be holding
  // acquireLock(legacyInWorkspaceDbPath, ...) which materializes as
  // <legacyInWorkspaceDbPath>.lock. Renaming it would yank the active lock
  // out from under the holder. .lock is runtime state that's safe to leave.
  await renameWithStamp(legacyInWorkspaceDbPath);
  await renameWithStamp(`${legacyInWorkspaceDbPath}.bak`);
}
