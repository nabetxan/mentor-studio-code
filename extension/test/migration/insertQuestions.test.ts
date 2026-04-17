import { join } from "node:path";
import type { Database } from "sql.js";
import { describe, expect, it } from "vitest";
import { SCHEMA_DDL } from "../../src/db/schema";
import { loadSqlJs } from "../../src/db/sqlJsLoader";
import { insertPlans } from "../../src/migration/insertPlans";
import {
  insertQuestions,
  type LegacyGap,
  type LegacyQuestion,
} from "../../src/migration/insertQuestions";
import {
  insertTopics,
  type LegacyTopic,
} from "../../src/migration/insertTopics";
import type { LegacyPlanState } from "../../src/migration/legacyPlan";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");
const noHeading = async () => null;

async function mkDb(): Promise<Database> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database();
  db.exec(SCHEMA_DDL);
  return db;
}

async function setupFixture(
  db: Database,
  topics: LegacyTopic[] = [{ key: "js", label: "JS" }],
): Promise<{
  topicMap: Map<string, number>;
  taskMap: Map<string, number>;
  legacyPlanState: LegacyPlanState;
}> {
  const topicMap = insertTopics(db, topics);
  const { taskIdMap } = await insertPlans(
    db,
    {
      completed_tasks: [{ id: "task-1", name: "Task1", plan: "p.md" }],
      skipped_tasks: [],
      current_task: null,
    },
    {},
    noHeading,
  );
  return {
    topicMap,
    taskMap: taskIdMap,
    legacyPlanState: { legacyPlanId: null },
  };
}

function q(partial: Partial<LegacyQuestion>): LegacyQuestion {
  return {
    id: "q?",
    answeredAt: "2026-03-22T00:00:00Z",
    taskId: "task-1",
    topic: "js",
    concept: "c",
    question: "q?",
    userAnswer: "a",
    isCorrect: true,
    ...partial,
  };
}

function rowsOf(db: Database, sql: string): Array<Record<string, unknown>> {
  const res = db.exec(sql);
  if (!res[0]) return [];
  return res[0].values.map((v) => {
    const o: Record<string, unknown> = {};
    res[0].columns.forEach((c, i) => {
      o[c] = v[i];
    });
    return o;
  });
}

describe("insertQuestions", () => {
  it("inserts roots and merges a single review into root", async () => {
    const db = await mkDb();
    const ctx = await setupFixture(db);
    const history: LegacyQuestion[] = [
      q({ id: "q1", answeredAt: "2026-03-22T00:01:00Z", isCorrect: false }),
      q({ id: "q2", answeredAt: "2026-03-22T00:02:00Z", isCorrect: true }),
      q({
        id: "q3",
        answeredAt: "2026-03-22T00:03:00Z",
        reviewOf: "q1",
        userAnswer: "correct-now",
        isCorrect: true,
      }),
    ];
    insertQuestions(db, { history, gaps: [], ...ctx });
    const qs = rowsOf(
      db,
      "SELECT isCorrect, userAnswer, attempts, lastAnsweredAt FROM questions ORDER BY id",
    );
    expect(qs).toHaveLength(2);
    expect(qs[0].isCorrect).toBe(1);
    expect(qs[0].userAnswer).toBe("correct-now");
    expect(qs[0].attempts).toBe(2);
    expect(qs[0].lastAnsweredAt).toBe("2026-03-22T00:03:00Z");
    db.close();
  });

  it("applies multiple reviews in timestamp order, last wins, attempts counts all", async () => {
    const db = await mkDb();
    const ctx = await setupFixture(db);
    const history: LegacyQuestion[] = [
      q({ id: "q1", answeredAt: "2026-03-22T00:01:00Z", isCorrect: false }),
      q({
        id: "q3",
        answeredAt: "2026-03-22T00:03:00Z",
        reviewOf: "q1",
        userAnswer: "middle",
        isCorrect: false,
      }),
      q({
        id: "q2",
        answeredAt: "2026-03-22T00:02:00Z",
        reviewOf: "q1",
        userAnswer: "early",
        isCorrect: true,
      }),
    ];
    insertQuestions(db, { history, gaps: [], ...ctx });
    const qs = rowsOf(
      db,
      "SELECT userAnswer, isCorrect, attempts FROM questions",
    );
    expect(qs[0].userAnswer).toBe("middle");
    expect(qs[0].isCorrect).toBe(0);
    expect(qs[0].attempts).toBe(3);
    db.close();
  });

  it("warns when reviewOf points to missing root", async () => {
    const db = await mkDb();
    const ctx = await setupFixture(db);
    const history: LegacyQuestion[] = [
      q({ id: "q1", reviewOf: "nonexistent" }),
    ];
    const warns: string[] = [];
    insertQuestions(db, { history, gaps: [], ...ctx }, (m) => warns.push(m));
    expect(warns.length).toBeGreaterThan(0);
    expect(rowsOf(db, "SELECT id FROM questions")).toHaveLength(0);
    db.close();
  });

  it("creates placeholder task under Legacy plan when taskId is unknown", async () => {
    const db = await mkDb();
    const ctx = await setupFixture(db);
    const history: LegacyQuestion[] = [q({ id: "q1", taskId: "orphan-task" })];
    insertQuestions(db, { history, gaps: [], ...ctx });
    const tasks = rowsOf(
      db,
      "SELECT name, planId FROM tasks WHERE name = 'orphan-task'",
    );
    expect(tasks).toHaveLength(1);
    const legacyPlan = rowsOf(
      db,
      "SELECT id FROM plans WHERE name = 'Legacy' AND filePath IS NULL",
    );
    expect(legacyPlan).toHaveLength(1);
    expect(tasks[0].planId).toBe(legacyPlan[0].id);
    db.close();
  });

  it("creates topic on-the-fly when topic is unknown", async () => {
    const db = await mkDb();
    const ctx = await setupFixture(db);
    const history: LegacyQuestion[] = [q({ id: "q1", topic: "unknown-topic" })];
    insertQuestions(db, { history, gaps: [], ...ctx });
    const topics = rowsOf(
      db,
      "SELECT label FROM topics WHERE label = 'unknown-topic'",
    );
    expect(topics).toHaveLength(1);
    db.close();
  });

  it("applies unresolved_gaps note and forces isCorrect=0", async () => {
    const db = await mkDb();
    const ctx = await setupFixture(db);
    const history: LegacyQuestion[] = [
      q({ id: "q1", isCorrect: true }),
      q({ id: "q2", isCorrect: false }),
    ];
    const gaps: LegacyGap[] = [{ questionId: "q1", note: "misunderstood" }];
    insertQuestions(db, { history, gaps, ...ctx });
    const qs = rowsOf(db, "SELECT isCorrect, note FROM questions ORDER BY id");
    expect(qs[0]).toEqual({ isCorrect: 0, note: "misunderstood" });
    expect(qs[1]).toEqual({ isCorrect: 0, note: null });
    db.close();
  });

  it("skips self-referencing review", async () => {
    const db = await mkDb();
    const ctx = await setupFixture(db);
    const warns: string[] = [];
    insertQuestions(
      db,
      {
        history: [q({ id: "q1", reviewOf: "q1" })],
        gaps: [],
        ...ctx,
      },
      (m) => warns.push(m),
    );
    expect(warns.some((w) => w.includes("self-reviewOf"))).toBe(true);
    db.close();
  });
});
