import { existsSync, readFileSync } from "node:fs";
import { atomicWriteFile, loadSqlJs } from "../db";

export interface HealResult {
  changed: boolean;
  from: unknown;
  to: number | null;
  reason?: "malformed";
}

export async function selfHealProgress(
  dbPath: string,
  progressPath: string,
  wasmPath: string,
): Promise<HealResult> {
  if (!existsSync(dbPath)) {
    return { changed: false, from: null, to: null };
  }
  const SQL = await loadSqlJs(wasmPath);
  const db = new SQL.Database(readFileSync(dbPath));
  let activeId: number | null = null;
  try {
    const stmt = db.prepare(
      "SELECT id FROM tasks WHERE status = 'active' LIMIT 1",
    );
    try {
      if (stmt.step()) {
        const v = stmt.get()[0];
        if (v !== null && v !== undefined) activeId = Number(v);
      }
    } finally {
      stmt.free();
    }
  } finally {
    db.close();
  }

  const defaultProgress: Record<string, unknown> = {
    current_task: null,
    current_step: null,
    resume_context: null,
    learner_profile: {},
  };
  let progress: Record<string, unknown> = defaultProgress;
  if (existsSync(progressPath)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(progressPath, "utf-8"));
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        progress = parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed progress.json — do not overwrite it.
      return { changed: false, from: null, to: null, reason: "malformed" };
    }
  }
  const before = progress.current_task ?? null;
  const beforeNum = typeof before === "number" ? before : null;
  if (beforeNum === activeId) {
    return { changed: false, from: before, to: activeId };
  }
  progress.current_task = activeId;
  await atomicWriteFile(
    progressPath,
    Buffer.from(JSON.stringify(progress, null, 2) + "\n"),
  );
  return { changed: true, from: before, to: activeId };
}
