import { beforeEach, describe, expect, it } from "vitest";

import { comprehensionCheckBrief } from "../../../src/cli/commands/sessionBrief/comprehensionCheck";
import {
  makeEnvWithDb,
  seedQuestions,
  seedTopics,
  withDb,
  type SeedQuestion,
  type TestEnv,
} from "../helpers";

describe("comprehensionCheckBrief", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
    await seedTopics(env.paths.dbPath, ["T1", "T2"]);
  });

  it("returns empty arrays with no coveredConceptsTotal on empty DB", async () => {
    const out = await withDb(env.paths.dbPath, (db) =>
      comprehensionCheckBrief(db),
    );
    expect(out).toEqual({
      coveredConcepts: [],
      topicSummary: [],
      allTopics: [
        { id: 1, label: "T1" },
        { id: 2, label: "T2" },
      ],
    });
    expect("coveredConceptsTotal" in out).toBe(false);
  });

  it("groups by (topicId, concept) and counts occurrences", async () => {
    const mk = (
      topicId: number,
      concept: string,
      at: string,
    ): SeedQuestion => ({
      topicId,
      concept,
      question: "q",
      userAnswer: "a",
      isCorrect: 1,
      lastAnsweredAt: at,
    });
    await seedQuestions(env.paths.dbPath, [
      mk(1, "c1", "2026-04-10T00:00:00Z"),
      mk(1, "c1", "2026-04-11T00:00:00Z"),
      mk(1, "c2", "2026-04-12T00:00:00Z"),
      mk(1, "c2", "2026-04-13T00:00:00Z"),
      mk(2, "c3", "2026-04-14T00:00:00Z"),
      mk(2, "c3", "2026-04-15T00:00:00Z"),
    ]);

    const out = await withDb(env.paths.dbPath, (db) =>
      comprehensionCheckBrief(db),
    );
    expect(out.coveredConcepts).toHaveLength(3);
    expect(out.coveredConcepts.every((c) => c.count === 2)).toBe(true);
    expect(out.topicSummary).toEqual([
      { topicId: 1, count: 4 },
      { topicId: 2, count: 2 },
    ]);
    expect("coveredConceptsTotal" in out).toBe(false);
  });

  it("sorts coveredConcepts by count DESC, concept ASC on ties", async () => {
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "b",
        question: "q",
        userAnswer: "a",
        isCorrect: 1,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "a",
        question: "q",
        userAnswer: "a",
        isCorrect: 1,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: 1,
        lastAnsweredAt: "2026-04-10T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: 1,
        lastAnsweredAt: "2026-04-11T00:00:00Z",
      },
    ]);
    const out = await withDb(env.paths.dbPath, (db) =>
      comprehensionCheckBrief(db),
    );
    expect(out.coveredConcepts.map((c) => c.concept)).toEqual(["c", "a", "b"]);
  });

  it("caps coveredConcepts at 100 and reports coveredConceptsTotal when distinct > 100", async () => {
    const questions: SeedQuestion[] = Array.from({ length: 101 }, (_, i) => ({
      topicId: 1,
      concept: `concept-${String(i).padStart(3, "0")}`,
      question: "q",
      userAnswer: "a",
      isCorrect: 1 as const,
      lastAnsweredAt: "2026-04-10T00:00:00Z",
    }));
    await seedQuestions(env.paths.dbPath, questions);
    const out = await withDb(env.paths.dbPath, (db) =>
      comprehensionCheckBrief(db),
    );
    expect(out.coveredConcepts).toHaveLength(100);
    expect(out.coveredConceptsTotal).toBe(101);
  });
});
