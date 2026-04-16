import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  acquireLock,
  assertStatusInvariants,
  atomicWriteFile,
  loadSqlJs,
  releaseLock,
  SCHEMA_DDL,
  SCHEMA_VERSION,
} from "../db";
import { createBackups } from "./backup";
import { insertPlans, type LegacyTask } from "./insertPlans";
import {
  insertQuestions,
  type LegacyGap,
  type LegacyQuestion,
} from "./insertQuestions";
import { insertTopics, type LegacyTopic } from "./insertTopics";
import { createPlaceholderTask, ensureLegacyPlan } from "./legacyPlan";
import { rewriteConfig, rewriteProgress } from "./rewriteJson";

interface RawTaskObject {
  task?: string;
  id?: string;
  name?: string;
  plan?: string;
}

function partitionTaskEntries(entries: unknown[] | undefined): {
  strings: string[];
  objects: RawTaskObject[];
} {
  const strings: string[] = [];
  const objects: RawTaskObject[] = [];
  for (const e of entries ?? []) {
    if (typeof e === "string") {
      strings.push(e);
    } else if (e !== null && typeof e === "object") {
      objects.push(e as RawTaskObject);
    }
  }
  return { strings, objects };
}

function normalizeStructured(
  entries: RawTaskObject[],
  warn: (msg: string) => void,
): LegacyTask[] {
  const out: LegacyTask[] = [];
  for (const e of entries) {
    const id = e.id ?? e.task;
    const plan = e.plan;
    if (typeof id !== "string" || typeof plan !== "string") {
      warn(
        `dropping legacy task entry (missing id/plan): ${JSON.stringify(e)}`,
      );
      continue;
    }
    out.push({ id, name: e.name ?? id, plan });
  }
  return out;
}

export interface MigrationStats {
  topics: number;
  plans: number;
  tasks: number;
  questions: number;
}

export type MigrationOk = {
  ok: true;
  stats: MigrationStats;
  bakPaths: string[];
};
export type MigrationFail = {
  ok: false;
  error: string;
  detail?: string;
};

export interface MigrateOptions {
  /** Override heading reader (used for tests or when plan files live outside mentorDir). */
  readPlanFileHeading?: (filePath: string) => Promise<string | null>;
  /** Root dir plan filePaths are resolved against for default heading reader. */
  planBaseDir?: string;
}

async function defaultReadHeading(
  filePath: string,
  baseDir: string,
): Promise<string | null> {
  try {
    const full = join(baseDir, filePath);
    if (!existsSync(full)) return null;
    const content = await readFile(full, "utf-8");
    const firstLine = content.split("\n", 2)[0];
    const m = /^#\s+(.+?)\s*$/.exec(firstLine);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function parseHistory(raw: unknown): LegacyQuestion[] {
  if (Array.isArray(raw)) return raw as LegacyQuestion[];
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { history?: unknown }).history)
  ) {
    return (raw as { history: LegacyQuestion[] }).history;
  }
  return [];
}

export async function migrate(
  mentorDir: string,
  wasmPath: string,
  options: MigrateOptions = {},
): Promise<MigrationOk | MigrationFail> {
  const dbPath = join(mentorDir, "data.db");
  const legacyPlanState = { legacyPlanId: null as number | null };
  const planBaseDir = options.planBaseDir ?? join(mentorDir, "..");
  const readHeading =
    options.readPlanFileHeading ??
    ((fp: string): Promise<string | null> =>
      defaultReadHeading(fp, planBaseDir));

  const lock = await acquireLock(dbPath, { purpose: "migration" });
  try {
    const bakPaths = await createBackups(mentorDir);

    let config: Record<string, unknown>;
    let progress: Record<string, unknown>;
    let historyRaw: unknown;
    try {
      config = JSON.parse(
        readFileSync(join(mentorDir, "config.json"), "utf-8"),
      ) as Record<string, unknown>;
      progress = JSON.parse(
        readFileSync(join(mentorDir, "progress.json"), "utf-8"),
      ) as Record<string, unknown>;
      historyRaw = JSON.parse(
        readFileSync(join(mentorDir, "question-history.json"), "utf-8"),
      );
    } catch (e) {
      return {
        ok: false,
        error: "legacy_read_failed",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
    const history = parseHistory(historyRaw);
    const gaps: LegacyGap[] = Array.isArray(progress.unresolved_gaps)
      ? (progress.unresolved_gaps as LegacyGap[])
      : [];

    const SQL = await loadSqlJs(wasmPath);
    const db = new SQL.Database();
    db.exec(SCHEMA_DDL);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

    const warn = (msg: string): void => {
      console.warn(`[migration] ${msg}`);
    };

    db.exec("BEGIN IMMEDIATE");
    let taskIdMap: Map<string, number>;
    try {
      const topics = (config.topics as LegacyTopic[] | undefined) ?? [];
      const topicMap = insertTopics(db, topics);

      const completedSplit = partitionTaskEntries(
        progress.completed_tasks as unknown[] | undefined,
      );
      const skippedSplit = partitionTaskEntries(
        progress.skipped_tasks as unknown[] | undefined,
      );

      const planResult = await insertPlans(
        db,
        {
          completed_tasks: normalizeStructured(completedSplit.objects, warn),
          skipped_tasks: normalizeStructured(skippedSplit.objects, warn),
          current_task:
            (progress.current_task as string | null | undefined) ?? null,
        },
        {
          mentorFiles: (config.mentorFiles ?? null) as {
            plan?: string | null;
          } | null,
        },
        readHeading,
      );
      taskIdMap = planResult.taskIdMap;

      // Pre-schema string entries: bucket under the synthesized "Legacy" plan.
      for (const s of completedSplit.strings) {
        const lpid = ensureLegacyPlan(db, legacyPlanState);
        createPlaceholderTask(db, lpid, s, "completed");
      }
      for (const s of skippedSplit.strings) {
        const lpid = ensureLegacyPlan(db, legacyPlanState);
        createPlaceholderTask(db, lpid, s, "skipped");
      }

      insertQuestions(db, {
        history,
        gaps,
        topicMap,
        taskMap: taskIdMap,
        legacyPlanState,
      });
      assertStatusInvariants(db);
      db.exec("COMMIT");
    } catch (e) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      db.close();
      if (existsSync(dbPath)) {
        try {
          unlinkSync(dbPath);
        } catch {
          /* ignore */
        }
      }
      return {
        ok: false,
        error: "migration_failed",
        detail: e instanceof Error ? e.message : String(e),
      };
    }

    const bytes = Buffer.from(db.export());
    db.close();
    await atomicWriteFile(dbPath, bytes);

    try {
      const newProgress = rewriteProgress({ progress });
      await atomicWriteFile(
        join(mentorDir, "progress.json"),
        Buffer.from(`${JSON.stringify(newProgress, null, 2)}\n`),
      );
      const newConfig = rewriteConfig(config);
      await atomicWriteFile(
        join(mentorDir, "config.json"),
        Buffer.from(`${JSON.stringify(newConfig, null, 2)}\n`),
      );
    } catch (e) {
      return {
        ok: false,
        error: "migration_partial",
        detail: e instanceof Error ? e.message : String(e),
      };
    }

    const SQL2 = await loadSqlJs(wasmPath);
    const reload = new SQL2.Database(readFileSync(dbPath));
    const count = (sql: string): number =>
      Number(reload.exec(sql)[0].values[0][0]);
    const stats: MigrationStats = {
      topics: count("SELECT COUNT(*) FROM topics"),
      plans: count("SELECT COUNT(*) FROM plans"),
      tasks: count("SELECT COUNT(*) FROM tasks"),
      questions: count("SELECT COUNT(*) FROM questions"),
    };
    reload.close();

    return { ok: true, stats, bakPaths };
  } finally {
    await releaseLock(lock);
  }
}
