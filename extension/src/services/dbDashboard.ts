import type {
  CompletedTask,
  DashboardData,
  PlanDto,
  PlanStatus,
  TopicConfig,
  TopicStats,
  UnresolvedGap,
} from "@mentor-studio/shared";
import { readFileSync } from "node:fs";
import type { BindParams, Database, SqlValue } from "sql.js";
import { loadSqlJs, withWriteTransaction } from "../db";

export function topicIdToKey(id: number): string {
  return `t_${id}`;
}

export function topicKeyToId(key: string): number | null {
  const m = /^t_(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}

interface RowQuery {
  columns: string[];
  values: SqlValue[][];
}

function exec(db: Database, sql: string, params?: BindParams): RowQuery[] {
  const stmt = db.prepare(sql);
  try {
    if (params) stmt.bind(params);
    const rows: SqlValue[][] = [];
    const columns = stmt.getColumnNames();
    while (stmt.step()) {
      rows.push(stmt.get());
    }
    return [{ columns, values: rows }];
  } finally {
    stmt.free();
  }
}

export function readTopicsFromDb(db: Database): TopicConfig[] {
  const res = exec(db, "SELECT id, label FROM topics ORDER BY id");
  if (!res[0]) return [];
  return res[0].values.map((r) => ({
    key: topicIdToKey(Number(r[0])),
    label: String(r[1]),
  }));
}

export function computeDashboardDataFromDb(db: Database): DashboardData {
  // Total + correct
  const totalRow = exec(
    db,
    "SELECT COUNT(*) AS c, SUM(CASE WHEN isCorrect=1 THEN 1 ELSE 0 END) AS correct FROM questions",
  )[0];
  const totalQuestions = Number(totalRow?.values[0]?.[0] ?? 0);
  const correct = Number(totalRow?.values[0]?.[1] ?? 0);
  const correctRate = totalQuestions > 0 ? correct / totalQuestions : 0;

  // By-topic stats
  const byTopicRes = exec(
    db,
    `SELECT t.id, t.label,
            COUNT(q.id) AS total,
            SUM(CASE WHEN q.isCorrect=1 THEN 1 ELSE 0 END) AS correct
     FROM topics t
     LEFT JOIN questions q ON q.topicId = t.id
     GROUP BY t.id
     ORDER BY t.id`,
  )[0];
  const byTopic: TopicStats[] = [];
  const topicsWithHistory: string[] = [];
  for (const r of byTopicRes?.values ?? []) {
    const id = Number(r[0]);
    const label = String(r[1]);
    const total = Number(r[2] ?? 0);
    const correctT = Number(r[3] ?? 0);
    const key = topicIdToKey(id);
    if (total > 0) topicsWithHistory.push(key);
    const rate = total > 0 ? correctT / total : 0;
    if (total > 0 && rate < 1) {
      byTopic.push({ topic: key, label, total, correct: correctT, rate });
    }
  }
  byTopic.sort((a, b) => a.rate - b.rate);

  const allTopics = readTopicsFromDb(db);

  // Unresolved gaps = questions where isCorrect = 0 (latest per concept? keep simple: all rows)
  const gapsRes = exec(
    db,
    `SELECT q.id, q.concept, q.topicId, q.lastAnsweredAt, t.name AS taskName, q.note
     FROM questions q
     LEFT JOIN tasks t ON t.id = q.taskId
     WHERE q.isCorrect = 0
     ORDER BY q.lastAnsweredAt DESC`,
  )[0];
  const unresolvedGaps: UnresolvedGap[] = (gapsRes?.values ?? []).map((r) => ({
    questionId: `q_${Number(r[0])}`,
    concept: String(r[1] ?? ""),
    topic: topicIdToKey(Number(r[2])),
    last_missed: String(r[3] ?? ""),
    task: r[4] !== null && r[4] !== undefined ? String(r[4]) : "",
    note: r[5] !== null && r[5] !== undefined ? String(r[5]) : "",
  }));

  // Completed tasks
  const completedRes = exec(
    db,
    `SELECT t.id, t.name, p.name
     FROM tasks t JOIN plans p ON p.id = t.planId
     WHERE t.status = 'completed'
     ORDER BY p.sortOrder, t.sortOrder`,
  )[0];
  const completedTasks: CompletedTask[] = (completedRes?.values ?? []).map(
    (r) => ({
      task: String(Number(r[0])),
      name: String(r[1] ?? ""),
      plan: String(r[2] ?? ""),
    }),
  );

  // Current task: query DB for the single active task
  let currentTask: string | null = null;
  const activeRow = exec(
    db,
    "SELECT name FROM tasks WHERE status = 'active' LIMIT 1",
  )[0];
  const activeName = activeRow?.values[0]?.[0];
  if (activeName !== null && activeName !== undefined) {
    currentTask = String(activeName);
  }

  const profileRes = exec(
    db,
    "SELECT lastUpdated FROM learner_profile ORDER BY lastUpdated DESC, id DESC LIMIT 1",
  )[0];
  const profileLastUpdated =
    profileRes && profileRes.values.length > 0 && profileRes.values[0][0] !== null
      ? String(profileRes.values[0][0])
      : null;

  // Plans
  const plansRes = exec(
    db,
    "SELECT id, name, filePath, status, sortOrder FROM plans ORDER BY sortOrder ASC",
  )[0];
  const plans: PlanDto[] = (plansRes?.values ?? []).map((r) => ({
    id: Number(r[0]),
    name: String(r[1] ?? ""),
    filePath: r[2] === null || r[2] === undefined ? null : String(r[2]),
    status: String(r[3]) as PlanStatus,
    sortOrder: Number(r[4]),
  }));
  const activePlan = plans.find((p) => p.status === "active") ?? null;
  const nextPlan =
    plans
      .filter((p) => p.status === "queued")
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;

  return {
    totalQuestions,
    correctRate,
    byTopic,
    allTopics,
    unresolvedGaps,
    completedTasks,
    currentTask,
    profileLastUpdated,
    topicsWithHistory,
    plans,
    activePlan,
    nextPlan,
  };
}

// ---------- Topic write ops (DB-backed) ----------

export async function dbReadTopics(
  dbPath: string,
  wasmPath: string,
): Promise<TopicConfig[]> {
  const SQL = await loadSqlJs(wasmPath);
  const db = new SQL.Database(readFileSync(dbPath));
  try {
    return readTopicsFromDb(db);
  } finally {
    db.close();
  }
}

export async function dbAddTopic(
  dbPath: string,
  label: string,
  wasmPath: string,
): Promise<{ ok: boolean; key?: string; error?: string }> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "empty_label" };
  return withWriteTransaction(
    dbPath,
    { wasmPath, purpose: "normal" },
    async (db) => {
      const existing = exec(
        db,
        "SELECT 1 FROM topics WHERE label = ? LIMIT 1",
        [trimmed],
      )[0];
      if (existing && existing.values.length > 0) {
        return { ok: false, error: "duplicate_label" };
      }
      const ins = db.prepare("INSERT INTO topics (label) VALUES (?)");
      try {
        ins.run([trimmed]);
      } finally {
        ins.free();
      }
      const idRow = exec(db, "SELECT last_insert_rowid()")[0];
      const id = Number(idRow?.values[0]?.[0] ?? 0);
      return { ok: true, key: topicIdToKey(id) };
    },
  );
}

export async function dbUpdateTopicLabel(
  dbPath: string,
  key: string,
  newLabel: string,
  wasmPath: string,
): Promise<void> {
  const id = topicKeyToId(key);
  if (id === null) return;
  const trimmed = newLabel.trim();
  if (!trimmed) return;
  await withWriteTransaction(
    dbPath,
    { wasmPath, purpose: "normal" },
    async (db) => {
      const upd = db.prepare("UPDATE topics SET label = ? WHERE id = ?");
      try {
        upd.run([trimmed, id]);
      } finally {
        upd.free();
      }
    },
  );
}

export async function dbMergeTopic(
  dbPath: string,
  fromKey: string,
  toKey: string,
  wasmPath: string,
): Promise<void> {
  const fromId = topicKeyToId(fromKey);
  const toId = topicKeyToId(toKey);
  if (fromId === null || toId === null || fromId === toId) return;
  await withWriteTransaction(
    dbPath,
    { wasmPath, purpose: "normal" },
    async (db) => {
      const upd = db.prepare(
        "UPDATE questions SET topicId = ? WHERE topicId = ?",
      );
      try {
        upd.run([toId, fromId]);
      } finally {
        upd.free();
      }
      const del = db.prepare("DELETE FROM topics WHERE id = ?");
      try {
        del.run([fromId]);
      } finally {
        del.free();
      }
    },
  );
}

export async function dbDeleteTopics(
  dbPath: string,
  keys: string[],
  wasmPath: string,
): Promise<{ key: string; ok: boolean; error?: string }[]> {
  return withWriteTransaction(
    dbPath,
    { wasmPath, purpose: "normal" },
    async (db) => {
      const results: { key: string; ok: boolean; error?: string }[] = [];
      for (const key of keys) {
        const id = topicKeyToId(key);
        if (id === null) {
          results.push({ key, ok: false, error: "invalid_key" });
          continue;
        }
        const exists = exec(db, "SELECT 1 FROM topics WHERE id = ? LIMIT 1", [
          id,
        ])[0];
        if (!exists || exists.values.length === 0) {
          results.push({ key, ok: false, error: "topic_not_found" });
          continue;
        }
        const ref = exec(
          db,
          "SELECT 1 FROM questions WHERE topicId = ? LIMIT 1",
          [id],
        )[0];
        if (ref && ref.values.length > 0) {
          results.push({ key, ok: false, error: "has_related_data" });
          continue;
        }
        const del = db.prepare("DELETE FROM topics WHERE id = ?");
        try {
          del.run([id]);
        } finally {
          del.free();
        }
        results.push({ key, ok: true });
      }
      return results;
    },
  );
}
