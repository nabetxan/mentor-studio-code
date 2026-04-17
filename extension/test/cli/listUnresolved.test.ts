import { beforeEach, describe, expect, it } from "vitest";

import { listUnresolved } from "../../src/cli/commands/listUnresolved";
import {
  makeEnv,
  makeEnvWithDb,
  seedQuestions,
  seedTopics,
  type TestEnv,
} from "./helpers";

describe("list-unresolved", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
    await seedTopics(env.paths.dbPath, ["Topic1", "Topic2"]);
  });

  it("returns db_missing when DB does not exist", async () => {
    const fresh = makeEnv();
    const res = await listUnresolved({}, fresh.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  it("returns empty gaps when DB has no questions", async () => {
    const res = await listUnresolved({}, env.paths);
    expect(res).toEqual({
      ok: true,
      gaps: [],
      gapCount: { total: 0, filtered: 0 },
    });
  });

  it("returns all unresolved questions with total and filtered counts", async () => {
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "c1",
        question: "q1",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "c2",
        question: "q2",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-11T00:00:00Z",
      },
      {
        topicId: 2,
        concept: "c3",
        question: "q3",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-12T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "c4",
        question: "q4",
        userAnswer: "a",
        isCorrect: 1,
        lastAnsweredAt: "2026-04-13T00:00:00Z",
      },
    ]);

    const res = await listUnresolved({}, env.paths);
    if (!res.ok) throw new Error(`expected ok, got ${JSON.stringify(res)}`);
    const gaps = res.gaps as { concept: string; isCorrect: boolean }[];
    expect(gaps.map((g) => g.concept)).toEqual(["c1", "c2", "c3"]);
    expect(gaps.every((g) => g.isCorrect === false)).toBe(true);
    expect(res.gapCount).toEqual({ total: 3, filtered: 3 });
  });

  it("filters by topicId but total stays global", async () => {
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "c1",
        question: "q1",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "c2",
        question: "q2",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-11T00:00:00Z",
      },
      {
        topicId: 2,
        concept: "c3",
        question: "q3",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-12T00:00:00Z",
      },
    ]);

    const res = await listUnresolved({ topicId: 1 }, env.paths);
    if (!res.ok) throw new Error("expected ok");
    expect((res.gaps as unknown[]).length).toBe(2);
    expect(res.gapCount).toEqual({ total: 3, filtered: 2 });
  });

  it("respects limit", async () => {
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "c1",
        question: "q1",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "c2",
        question: "q2",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-11T00:00:00Z",
      },
    ]);

    const res = await listUnresolved({ limit: 1 }, env.paths);
    if (!res.ok) throw new Error("expected ok");
    expect((res.gaps as unknown[]).length).toBe(1);
    expect(res.gapCount).toEqual({ total: 2, filtered: 1 });
  });

  it("orders by lastAnsweredAt ASC, then id ASC on ties", async () => {
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "later",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-12T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "early-first",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "early-second",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
    ]);

    const res = await listUnresolved({}, env.paths);
    if (!res.ok) throw new Error("expected ok");
    const gaps = res.gaps as { concept: string; id: number }[];
    expect(gaps.map((g) => g.concept)).toEqual([
      "early-first",
      "early-second",
      "later",
    ]);
    expect(gaps[0].id).toBeLessThan(gaps[1].id);
  });

  it("returns empty gaps for non-existent topicId without changing total", async () => {
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "c1",
        question: "q1",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
    ]);

    const res = await listUnresolved({ topicId: 9999 }, env.paths);
    if (!res.ok) throw new Error("expected ok");
    expect(res.gaps).toEqual([]);
    expect(res.gapCount).toEqual({ total: 1, filtered: 0 });
  });

  describe("invalid args", () => {
    it.each([
      { limit: 0 },
      { limit: -1 },
      { limit: 1001 },
      { limit: 1.5 },
      { limit: "5" },
    ])("rejects limit=%j", async (args) => {
      const res = await listUnresolved(args, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it.each([{ topicId: 1.5 }, { topicId: "1" }])(
      "rejects topicId=%j",
      async (args) => {
        const res = await listUnresolved(args, env.paths);
        expect(res).toMatchObject({ ok: false, error: "invalid_args" });
      },
    );
  });
});
