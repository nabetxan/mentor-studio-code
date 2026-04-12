import { beforeEach, describe, expect, it } from "vitest";

import { implementationReviewBrief } from "../../../src/cli/commands/sessionBrief/implementationReview";
import {
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "../helpers";

describe("implementationReviewBrief", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
  });

  it("returns null currentTask and null resumeContext when empty", async () => {
    const out = await withDb(env.paths.dbPath, (db) =>
      implementationReviewBrief(db, {}),
    );
    expect(out).toEqual({ currentTask: null, resumeContext: null });
  });

  it("returns active task and resume_context when present", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "Plan",
        status: "active",
        sortOrder: 1,
        createdAt: "2026-04-01T00:00:00Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T1", status: "active", sortOrder: 1 },
    ]);

    const out = await withDb(env.paths.dbPath, (db) =>
      implementationReviewBrief(db, { resume_context: "picking up" }),
    );
    expect(out).toEqual({
      currentTask: { id: 1, name: "T1", planId: 1 },
      resumeContext: "picking up",
    });
  });

  it("treats non-string resume_context as null", async () => {
    const out = await withDb(env.paths.dbPath, (db) =>
      implementationReviewBrief(db, { resume_context: null }),
    );
    expect(out.resumeContext).toBeNull();
  });
});
