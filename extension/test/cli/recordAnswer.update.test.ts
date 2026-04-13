import { beforeEach, describe, expect, it } from "vitest";

import { recordAnswer } from "../../src/cli/commands/recordAnswer";
import {
  makeEnvWithDb,
  seedPlans,
  seedQuestions,
  seedTasks,
  seedTopics,
  withDb,
  type TestEnv,
} from "./helpers";

async function readQuestion(dbPath: string, id: number) {
  return withDb(dbPath, (db) => {
    const res = db.exec(
      `SELECT userAnswer, isCorrect, note, attempts, lastAnsweredAt FROM questions WHERE id = ${id}`,
    );
    if (!res[0]) return null;
    const row = res[0].values[0];
    return {
      userAnswer: String(row[0]),
      isCorrect: Number(row[1]),
      note: row[2] === null ? null : String(row[2]),
      attempts: Number(row[3]),
      lastAnsweredAt: String(row[4]),
    };
  });
}

describe("record-answer UPDATE", () => {
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
    await seedQuestions(env.paths.dbPath, [
      {
        taskId: 1,
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "old",
        isCorrect: 0,
        note: "original note",
        attempts: 2,
        lastAnsweredAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
  });

  it("returns not_found for non-existent id", async () => {
    const res = await recordAnswer(
      { id: 999, userAnswer: "a", isCorrect: true },
      env.paths,
    );
    expect(res).toEqual({ ok: false, error: "not_found" });
  });

  it("isCorrect=true clears note to NULL and increments attempts", async () => {
    const res = await recordAnswer(
      { id: 1, userAnswer: "new", isCorrect: true, note: "ignored" },
      env.paths,
    );
    expect(res).toMatchObject({ ok: true, id: 1, attempts: 3 });

    const row = await readQuestion(env.paths.dbPath, 1);
    expect(row?.userAnswer).toBe("new");
    expect(row?.isCorrect).toBe(1);
    expect(row?.note).toBeNull();
    expect(row?.attempts).toBe(3);
    expect(row?.lastAnsweredAt).not.toBe("2026-04-01T00:00:00.000Z");
  });

  it("isCorrect=false with note overwrites note", async () => {
    await recordAnswer(
      { id: 1, userAnswer: "new", isCorrect: false, note: "updated" },
      env.paths,
    );
    const row = await readQuestion(env.paths.dbPath, 1);
    expect(row?.note).toBe("updated");
    expect(row?.isCorrect).toBe(0);
    expect(row?.attempts).toBe(3);
  });

  it("isCorrect=false without note sets note to NULL", async () => {
    await recordAnswer(
      { id: 1, userAnswer: "new", isCorrect: false },
      env.paths,
    );
    const row = await readQuestion(env.paths.dbPath, 1);
    expect(row?.note).toBeNull();
  });

  it("returns invalid_args when userAnswer missing", async () => {
    const res = await recordAnswer({ id: 1, isCorrect: true }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns invalid_args when isCorrect missing", async () => {
    const res = await recordAnswer({ id: 1, userAnswer: "a" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });
});
