import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CliPaths } from "../../src/cli/context";
import { bootstrapDb, loadSqlJs } from "../../src/db";

export const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

export interface TestEnv {
  dir: string;
  paths: CliPaths;
}

export function makeEnv(): TestEnv {
  const dir = mkdtempSync(join(tmpdir(), "cli-"));
  const paths: CliPaths = {
    mentorRoot: dir,
    dbPath: join(dir, "data.db"),
    configPath: join(dir, "config.json"),
  };
  return { dir, paths };
}

export async function makeEnvWithDb(
  topics: { label: string }[] = [],
): Promise<TestEnv> {
  const env = makeEnv();
  await bootstrapDb(env.paths.dbPath, { wasmPath: WASM, topics });
  return env;
}

export interface SeedQuestion {
  taskId?: number | null;
  topicId: number;
  concept: string;
  question: string;
  userAnswer: string;
  isCorrect: 0 | 1;
  note?: string | null;
  attempts?: number;
  lastAnsweredAt: string;
}

export interface SeedPlan {
  name: string;
  filePath?: string | null;
  status: "active" | "queued" | "completed" | "paused" | "backlog" | "removed";
  sortOrder: number;
  createdAt: string;
}

export interface SeedTask {
  planId: number;
  name: string;
  status: "active" | "queued" | "completed" | "skipped";
  sortOrder: number;
}

// Test-only: bypasses `withWriteTransaction` locks. Fine for fixture seeding
// where no concurrent writers exist; do NOT mirror this pattern in prod code.
export async function mutateDb(
  dbPath: string,
  mutate: (db: import("sql.js").Database) => void,
): Promise<void> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database(readFileSync(dbPath));
  try {
    mutate(db);
    writeFileSync(dbPath, Buffer.from(db.export()));
  } finally {
    db.close();
  }
}

export async function withDb<T>(
  dbPath: string,
  fn: (db: import("sql.js").Database) => T,
): Promise<T> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database(readFileSync(dbPath));
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export async function seedTopics(
  dbPath: string,
  labels: string[],
): Promise<void> {
  await mutateDb(dbPath, (db) => {
    const stmt = db.prepare("INSERT INTO topics (label) VALUES (?)");
    try {
      for (const l of labels) stmt.run([l]);
    } finally {
      stmt.free();
    }
  });
}

export async function seedPlans(
  dbPath: string,
  plans: SeedPlan[],
): Promise<void> {
  await mutateDb(dbPath, (db) => {
    const stmt = db.prepare(
      "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)",
    );
    try {
      for (const p of plans) {
        stmt.run([
          p.name,
          p.filePath ?? null,
          p.status,
          p.sortOrder,
          p.createdAt,
        ]);
      }
    } finally {
      stmt.free();
    }
  });
}

export async function seedTasks(
  dbPath: string,
  tasks: SeedTask[],
): Promise<void> {
  await mutateDb(dbPath, (db) => {
    const stmt = db.prepare(
      "INSERT INTO tasks (planId, name, status, sortOrder) VALUES (?, ?, ?, ?)",
    );
    try {
      for (const t of tasks) {
        stmt.run([t.planId, t.name, t.status, t.sortOrder]);
      }
    } finally {
      stmt.free();
    }
  });
}

export async function seedQuestions(
  dbPath: string,
  questions: SeedQuestion[],
): Promise<void> {
  await mutateDb(dbPath, (db) => {
    const stmt = db.prepare(
      "INSERT INTO questions (taskId, topicId, concept, question, userAnswer, isCorrect, note, attempts, lastAnsweredAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    try {
      for (const q of questions) {
        stmt.run([
          q.taskId ?? null,
          q.topicId,
          q.concept,
          q.question,
          q.userAnswer,
          q.isCorrect,
          q.note ?? null,
          q.attempts ?? 1,
          q.lastAnsweredAt,
        ]);
      }
    } finally {
      stmt.free();
    }
  });
}

export async function seedProfileRow(
  dbPath: string,
  profile: {
    experience?: string;
    level?: string;
    interests?: string[];
    weak_areas?: string[];
    mentor_style?: string;
    last_updated: string;
  },
): Promise<void> {
  await mutateDb(dbPath, (db) => {
    const stmt = db.prepare(
      `INSERT INTO learner_profile
         (experience, level, interests, weakAreas, mentorStyle, lastUpdated)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    try {
      stmt.run([
        profile.experience ?? "",
        profile.level ?? "",
        JSON.stringify(profile.interests ?? []),
        JSON.stringify(profile.weak_areas ?? []),
        profile.mentor_style ?? "",
        profile.last_updated,
      ]);
    } finally {
      stmt.free();
    }
  });
}

export async function seedResumeContext(
  dbPath: string,
  value: string | null,
): Promise<void> {
  await mutateDb(dbPath, (db) => {
    const stmt = db.prepare(
      `INSERT INTO app_state (key, value) VALUES ('resume_context', ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    );
    try {
      stmt.run([value]);
    } finally {
      stmt.free();
    }
  });
}
