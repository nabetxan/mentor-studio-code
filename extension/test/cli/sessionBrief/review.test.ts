import { beforeEach, describe, expect, it } from "vitest";

import { reviewBrief } from "../../../src/cli/commands/sessionBrief/review";
import {
  makeEnvWithDb,
  seedQuestions,
  seedTopics,
  withDb,
  type SeedQuestion,
  type TestEnv,
} from "../helpers";

describe("reviewBrief", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
    await seedTopics(env.paths.dbPath, ["T1", "T2"]);
  });

  it("returns empty gaps with zero counts on empty DB", async () => {
    const out = await withDb(env.paths.dbPath, (db) => reviewBrief(db));
    expect(out).toEqual({ gaps: [], gapCount: { total: 0, filtered: 0 } });
  });

  it("caps filtered at 50 while total reflects full DB", async () => {
    const questions: SeedQuestion[] = Array.from({ length: 51 }, (_, i) => ({
      topicId: 1,
      concept: `c${i + 1}`,
      question: `q${i + 1}`,
      userAnswer: "a",
      isCorrect: 0,
      lastAnsweredAt: `2026-04-12T00:00:${String(i).padStart(2, "0")}Z`,
    }));
    await seedQuestions(env.paths.dbPath, questions);

    const out = await withDb(env.paths.dbPath, (db) => reviewBrief(db));
    expect(out.gaps.length).toBe(50);
    expect(out.gapCount).toEqual({ total: 51, filtered: 50 });
  });

  it("filters by topicId but keeps global total", async () => {
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "a",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
      {
        topicId: 2,
        concept: "b",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-11T00:00:00Z",
      },
    ]);

    const out = await withDb(env.paths.dbPath, (db) => reviewBrief(db, 1));
    expect(out.gaps.length).toBe(1);
    expect(out.gaps[0].concept).toBe("a");
    expect(out.gapCount).toEqual({ total: 2, filtered: 1 });
  });

  it("orders by lastAnsweredAt ASC", async () => {
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "late",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-12T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "early",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
    ]);
    const out = await withDb(env.paths.dbPath, (db) => reviewBrief(db));
    expect(out.gaps.map((g) => g.concept)).toEqual(["early", "late"]);
  });
});
