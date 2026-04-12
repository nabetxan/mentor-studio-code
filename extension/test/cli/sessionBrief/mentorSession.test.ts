import { beforeEach, describe, expect, it } from "vitest";

import { mentorSessionBrief } from "../../../src/cli/commands/sessionBrief/mentorSession";
import {
  makeEnvWithDb,
  seedPlans,
  seedQuestions,
  seedTasks,
  seedTopics,
  withDb,
  type TestEnv,
} from "../helpers";

describe("mentorSessionBrief", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
    await seedTopics(env.paths.dbPath, ["T1"]);
  });

  it("returns nulls and zeros on empty DB", async () => {
    const out = await withDb(env.paths.dbPath, (db) =>
      mentorSessionBrief(db, {}),
    );
    expect(out).toEqual({
      currentTask: null,
      currentStep: null,
      resumeContext: null,
      relevantGaps: [],
      gapCount: { total: 0, filtered: 0 },
    });
  });

  it("maps active task, current step, resume context, and unresolved gaps", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "Plan A",
        status: "active",
        sortOrder: 1,
        createdAt: "2026-04-01T00:00:00Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "Task1", status: "active", sortOrder: 1 },
      { planId: 1, name: "Task2", status: "queued", sortOrder: 2 },
    ]);
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
        topicId: 1,
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

    const progress = {
      current_step: "step-2",
      resume_context: "resuming after break",
    };

    const out = await withDb(env.paths.dbPath, (db) =>
      mentorSessionBrief(db, progress),
    );
    expect(out.currentTask).toEqual({ id: 1, name: "Task1", planId: 1 });
    expect(out.currentStep).toBe("step-2");
    expect(out.resumeContext).toBe("resuming after break");
    expect(out.relevantGaps.length).toBe(3);
    expect(out.relevantGaps.map((g) => g.concept)).toEqual(["c3", "c2", "c1"]);
    expect(out.gapCount).toEqual({ total: 3, filtered: 3 });
  });

  it("caps relevantGaps at 5 with DESC ordering", async () => {
    const questions = Array.from({ length: 7 }, (_, i) => ({
      topicId: 1,
      concept: `c${i + 1}`,
      question: `q${i + 1}`,
      userAnswer: "a",
      isCorrect: 0 as const,
      lastAnsweredAt: `2026-04-${String(10 + i).padStart(2, "0")}T00:00:00Z`,
    }));
    await seedQuestions(env.paths.dbPath, questions);

    const out = await withDb(env.paths.dbPath, (db) =>
      mentorSessionBrief(db, {}),
    );
    expect(out.relevantGaps.length).toBe(5);
    expect(out.relevantGaps.map((g) => g.concept)).toEqual([
      "c7",
      "c6",
      "c5",
      "c4",
      "c3",
    ]);
    expect(out.gapCount).toEqual({ total: 7, filtered: 5 });
  });
});
