import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const TARGETS: readonly string[] = [
  ".mentor/data.db",
  ".mentor/data.db.bak",
  ".mentor/data.db.lock",
];

const GLOB_TARGETS: readonly string[] = [
  ".mentor/data.db.migrated-*",
  ".mentor/data.db.bak.migrated-*",
  ".mentor/data.db.lock.migrated-*",
];

async function gitRunSilent(
  cwd: string,
  ...args: string[]
): Promise<void> {
  try {
    await execFileP("git", ["-C", cwd, ...args], { windowsHide: true });
  } catch {
    // swallow — caller wants best-effort behavior
  }
}

/**
 * Remove the legacy in-workspace `.mentor/data.db*` family from git's index
 * (without deleting the files on disk). Also stages `.mentor/.gitignore` so
 * the user's next single `git commit` finalizes the cleanup (N4).
 *
 * Idempotent and safe to call when nothing matches.
 */
export async function untrackLegacyDb(workspaceRoot: string): Promise<void> {
  // Direct paths: git rm --cached --ignore-unmatch <path>.
  for (const target of TARGETS) {
    await gitRunSilent(
      workspaceRoot,
      "rm",
      "--cached",
      "--ignore-unmatch",
      target,
    );
  }

  // Glob targets: enumerate via ls-files first (git rm does not expand globs).
  for (const glob of GLOB_TARGETS) {
    try {
      const { stdout } = await execFileP(
        "git",
        ["-C", workspaceRoot, "ls-files", glob],
        { windowsHide: true },
      );
      const files = stdout.split("\n").filter(Boolean);
      for (const f of files) {
        await gitRunSilent(
          workspaceRoot,
          "rm",
          "--cached",
          "--ignore-unmatch",
          f,
        );
      }
    } catch {
      // swallow — no matching glob
    }
  }

  // N4: stage the new .gitignore so the user's next `git commit` is one-shot.
  if (existsSync(join(workspaceRoot, ".mentor", ".gitignore"))) {
    await gitRunSilent(workspaceRoot, "add", ".mentor/.gitignore");
  }
}

/**
 * Returns true iff at least one legacy `.mentor/data.db*` file is currently
 * tracked by git in the given workspace. Used by activation to gate the
 * untrack notification.
 */
export async function hasTrackedLegacyDbFiles(
  workspaceRoot: string,
): Promise<boolean> {
  // Direct paths via ls-files (single batched call).
  try {
    const { stdout } = await execFileP(
      "git",
      ["-C", workspaceRoot, "ls-files", ...TARGETS],
      { windowsHide: true },
    );
    if (stdout.trim().length > 0) return true;
  } catch {
    // not a git repo, etc. — fall through to glob check (will also fail safely)
  }

  // Glob paths via ls-files (variadic).
  try {
    const { stdout } = await execFileP(
      "git",
      ["-C", workspaceRoot, "ls-files", ...GLOB_TARGETS],
      { windowsHide: true },
    );
    if (stdout.trim().length > 0) return true;
  } catch {
    // ignore
  }

  return false;
}
