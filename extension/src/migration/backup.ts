import { copyFile, stat } from "node:fs/promises";
import { join } from "node:path";

export class MigrationBackupError extends Error {
  constructor(
    public readonly file: string,
    cause: unknown,
  ) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`backup failed for ${file}: ${msg}`);
    this.name = "MigrationBackupError";
  }
}

const BACKUP_FILES = [
  "question-history.json",
  "progress.json",
  "config.json",
] as const;

export async function createBackups(mentorDir: string): Promise<string[]> {
  const created: string[] = [];
  for (const f of BACKUP_FILES) {
    const src = join(mentorDir, f);
    try {
      await stat(src);
    } catch {
      continue;
    }
    const dst = `${src}.bak`;
    try {
      await copyFile(src, dst);
      created.push(dst);
    } catch (e) {
      throw new MigrationBackupError(f, e);
    }
  }
  return created;
}
