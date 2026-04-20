import { beforeEach, describe, expect, it } from "vitest";

import { sessionBrief } from "../../../src/cli/commands/sessionBrief";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  seedProfileRow,
  seedQuestions,
  seedResumeContext,
  seedTasks,
  seedTopics,
  type TestEnv,
} from "../helpers";

describe("session-brief (integration)", () => {
  it("rejects missing/invalid flow", async () => {
    const env = await makeEnvWithDb();
    expect(await sessionBrief({}, env.paths)).toMatchObject({
      ok: false,
      error: "invalid_flow",
    });
    expect(await sessionBrief({ flow: "nope" }, env.paths)).toMatchObject({
      ok: false,
      error: "invalid_flow",
    });
  });

  it("returns db_missing when DB does not exist", async () => {
    const env = makeEnv();
    const res = await sessionBrief({ flow: "mentor-session" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  it("returns invalid_args for non-integer topicId on review flow", async () => {
    const env = await makeEnvWithDb();
    const res = await sessionBrief(
      { flow: "review", topicId: 1.5 },
      env.paths,
    );
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  describe("with DB", () => {
    let env: TestEnv;

    beforeEach(async () => {
      env = await makeEnvWithDb();
      await seedTopics(env.paths.dbPath, ["T1"]);
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "Active", status: "active", sortOrder: 1 },
      ]);
      await seedQuestions(env.paths.dbPath, [
        {
          topicId: 1,
          concept: "c1",
          question: "q",
          userAnswer: "a",
          isCorrect: 0,
          lastAnsweredAt: "2026-04-10T00:00:00Z",
        },
      ]);
    });

    it("defaults profile and progress fields when DB has no profile or resume_context", async () => {
      const res = await sessionBrief({ flow: "mentor-session" }, env.paths);
      if (!res.ok) throw new Error("expected ok");
      expect(res.flow).toBe("mentor-session");
      expect(res.learner).toMatchObject({
        experience: "",
        level: "",
        interests: [],
        weakAreas: [],
        mentorStyle: "",
        lastUpdated: null,
      });
      expect(res.resumeContext).toBeNull();
      expect(res).toHaveProperty("currentTask");
      expect(res).toHaveProperty("relevantGaps");
      expect(res).toHaveProperty("gapCount");
    });

    it("mentor-session shape reads latest learner_profile row + app_state.resume_context", async () => {
      await seedProfileRow(env.paths.dbPath, {
        experience: "exp",
        level: "beginner",
        interests: ["a"],
        weak_areas: ["w"],
        mentor_style: "socratic",
        last_updated: "2026-04-12T00:00:00Z",
      });
      await seedResumeContext(env.paths.dbPath, "r");

      const res = await sessionBrief({ flow: "mentor-session" }, env.paths);
      if (!res.ok) throw new Error("expected ok");
      expect(res.learner).toEqual({
        experience: "exp",
        level: "beginner",
        interests: ["a"],
        weakAreas: ["w"],
        mentorStyle: "socratic",
        lastUpdated: "2026-04-12T00:00:00Z",
      });
      expect(res.resumeContext).toBe("r");
    });

    it("picks the latest row when multiple learner_profile rows exist", async () => {
      await seedProfileRow(env.paths.dbPath, {
        experience: "old",
        level: "junior",
        last_updated: "2026-04-01T00:00:00Z",
      });
      await seedProfileRow(env.paths.dbPath, {
        experience: "new",
        level: "senior",
        last_updated: "2026-04-18T00:00:00Z",
      });

      const res = await sessionBrief({ flow: "mentor-session" }, env.paths);
      if (!res.ok) throw new Error("expected ok");
      expect(res.learner.experience).toBe("new");
      expect(res.learner.level).toBe("senior");
      expect(res.learner.lastUpdated).toBe("2026-04-18T00:00:00Z");
    });

    it("review shape omits lastUpdated and exposes gaps/gapCount", async () => {
      const res = await sessionBrief({ flow: "review" }, env.paths);
      if (!res.ok) throw new Error("expected ok");
      expect(res.learner).not.toHaveProperty("lastUpdated");
      expect(res).toHaveProperty("gaps");
      expect(res).toHaveProperty("gapCount");
    });

    it("comprehension-check shape exposes coveredConcepts/topicSummary/allTopics", async () => {
      const res = await sessionBrief(
        { flow: "comprehension-check" },
        env.paths,
      );
      if (!res.ok) throw new Error("expected ok");
      expect(res).toHaveProperty("coveredConcepts");
      expect(res).toHaveProperty("topicSummary");
      expect(res).toHaveProperty("allTopics");
      expect("coveredConceptsTotal" in res).toBe(false);
    });

    it("implementation-review shape exposes currentTask/resumeContext", async () => {
      await seedResumeContext(env.paths.dbPath, "r");
      const res = await sessionBrief(
        { flow: "implementation-review" },
        env.paths,
      );
      if (!res.ok) throw new Error("expected ok");
      expect(res.currentTask).toEqual({ id: 1, name: "Active", planId: 1 });
      expect(res.resumeContext).toBe("r");
    });
  });
});
