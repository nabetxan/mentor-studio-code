import { beforeEach, describe, expect, it } from "vitest";

import { recordAnswer } from "../../src/cli/commands/recordAnswer";
import {
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  seedTopics,
  withDb,
  type TestEnv,
} from "./helpers";

interface QuestionRow {
  id: number;
  taskId: number | null;
  topicId: number;
  concept: string;
  question: string;
  userAnswer: string;
  isCorrect: number;
  note: string | null;
  attempts: number;
  lastAnsweredAt: string;
}

async function readQuestion(
  dbPath: string,
  id: number,
): Promise<QuestionRow | null> {
  return withDb(dbPath, (db) => {
    const res = db.exec(
      `SELECT id, taskId, topicId, concept, question, userAnswer, isCorrect, note, attempts, lastAnsweredAt FROM questions WHERE id = ${id}`,
    );
    if (!res[0]) return null;
    const row = res[0].values[0];
    return {
      id: Number(row[0]),
      taskId: row[1] === null ? null : Number(row[1]),
      topicId: Number(row[2]),
      concept: String(row[3]),
      question: String(row[4]),
      userAnswer: String(row[5]),
      isCorrect: Number(row[6]),
      note: row[7] === null ? null : String(row[7]),
      attempts: Number(row[8]),
      lastAnsweredAt: String(row[9]),
    };
  });
}

describe("record-answer INSERT", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
    await seedTopics(env.paths.dbPath, ["HTML"]);
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "active",
        sortOrder: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T1", status: "active", sortOrder: 0 },
    ]);
  });

  it("returns invalid_args when required arg is missing", async () => {
    const base = {
      taskId: 1,
      topicId: 1,
      concept: "c",
      question: "q",
      userAnswer: "a",
      isCorrect: true,
    };
    for (const k of Object.keys(base) as (keyof typeof base)[]) {
      const args: Record<string, unknown> = { ...base };
      delete args[k];
      const res = await recordAnswer(args, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    }
  });

  it("returns invalid_taskId for non-existent taskId", async () => {
    const res = await recordAnswer(
      {
        taskId: 999,
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: true,
      },
      env.paths,
    );
    expect(res).toEqual({ ok: false, error: "invalid_taskId" });

    const count = await withDb(env.paths.dbPath, (db) =>
      Number(db.exec("SELECT COUNT(*) FROM questions")[0].values[0][0]),
    );
    expect(count).toBe(0);
  });

  it("returns invalid_topicId for non-existent topicId", async () => {
    const res = await recordAnswer(
      {
        taskId: 1,
        topicId: 999,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: true,
      },
      env.paths,
    );
    expect(res).toEqual({ ok: false, error: "invalid_topicId" });
  });

  it("inserts with attempts=1 and returns id", async () => {
    const res = await recordAnswer(
      {
        taskId: 1,
        topicId: 1,
        concept: "concept",
        question: "Q?",
        userAnswer: "A",
        isCorrect: true,
      },
      env.paths,
    );
    expect(res).toMatchObject({ ok: true, id: 1, attempts: 1 });

    const row = await readQuestion(env.paths.dbPath, 1);
    expect(row).toMatchObject({
      taskId: 1,
      topicId: 1,
      concept: "concept",
      question: "Q?",
      userAnswer: "A",
      isCorrect: 1,
      note: null,
      attempts: 1,
    });
    expect(row?.lastAnsweredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("forces note to NULL when isCorrect=true even if note provided", async () => {
    const res = await recordAnswer(
      {
        taskId: 1,
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: true,
        note: "should be ignored",
      },
      env.paths,
    );
    expect(res).toMatchObject({ ok: true, id: 1 });
    const row = await readQuestion(env.paths.dbPath, 1);
    expect(row?.note).toBeNull();
  });

  it("stores null note when isCorrect=false and note omitted", async () => {
    const res = await recordAnswer(
      {
        taskId: 1,
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: false,
      },
      env.paths,
    );
    expect(res).toMatchObject({ ok: true });
    const row = await readQuestion(env.paths.dbPath, 1);
    expect(row?.isCorrect).toBe(0);
    expect(row?.note).toBeNull();
  });

  it("stores provided note when isCorrect=false", async () => {
    await recordAnswer(
      {
        taskId: 1,
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: false,
        note: "misconception",
      },
      env.paths,
    );
    const row = await readQuestion(env.paths.dbPath, 1);
    expect(row?.note).toBe("misconception");
  });

  it("allows taskId=null (comprehension-check flow)", async () => {
    const res = await recordAnswer(
      {
        taskId: null,
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: true,
      },
      env.paths,
    );
    expect(res).toMatchObject({ ok: true, id: 1 });
    const row = await readQuestion(env.paths.dbPath, 1);
    expect(row?.taskId).toBeNull();
  });
});
