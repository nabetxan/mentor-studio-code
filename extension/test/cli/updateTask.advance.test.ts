import { beforeEach, describe, expect, it } from "vitest";

import { autoAdvance } from "../../src/cli/commands/updateTask/advance";
import { InvariantViolationError } from "../../src/db";
import {
  makeEnvWithDb,
  mutateDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "./helpers";

describe("autoAdvance", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
  });

  it("finds next queued task by sortOrder, returns nextTask", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "active",
        sortOrder: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T1", status: "completed", sortOrder: 0 },
      { planId: 1, name: "T2", status: "queued", sortOrder: 2 },
      { planId: 1, name: "T3", status: "queued", sortOrder: 1 },
    ]);

    const result = await withDb(env.paths.dbPath, (db) => autoAdvance(db, 1));

    expect(result.planCompleted).toBe(false);
    expect(result.nextTask).toEqual({ id: 3, name: "T3", planId: 1 });
  });

  it("returns planCompleted=true when no more queued tasks", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "active",
        sortOrder: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T1", status: "completed", sortOrder: 0 },
    ]);

    let advanced: ReturnType<typeof autoAdvance> | null = null;
    await mutateDb(env.paths.dbPath, (db) => {
      advanced = autoAdvance(db, 1);
    });

    expect(advanced).toEqual({ nextTask: null, planCompleted: true });

    const planStatus = await withDb(env.paths.dbPath, (db) => {
      const r = db.exec("SELECT status FROM plans WHERE id = 1");
      return String(r[0].values[0][0]);
    });
    expect(planStatus).toBe("completed");
  });

  it("throws InvariantViolationError when activating task under non-active plan", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "queued",
        sortOrder: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T1", status: "completed", sortOrder: 0 },
      { planId: 1, name: "T2", status: "queued", sortOrder: 1 },
    ]);

    await expect(
      withDb(env.paths.dbPath, (db) => autoAdvance(db, 1)),
    ).rejects.toBeInstanceOf(InvariantViolationError);
  });

  it("leaves other plans untouched", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "active",
        sortOrder: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      {
        name: "P2",
        status: "queued",
        sortOrder: 1,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T1", status: "completed", sortOrder: 0 },
      { planId: 1, name: "T2", status: "queued", sortOrder: 1 },
      { planId: 2, name: "T3", status: "queued", sortOrder: 0 },
    ]);

    await mutateDb(env.paths.dbPath, (db) => {
      autoAdvance(db, 1);
    });

    const rows = await withDb(env.paths.dbPath, (db) => {
      const r = db.exec(
        "SELECT id, status FROM tasks ORDER BY id; SELECT id, status FROM plans ORDER BY id",
      );
      return {
        tasks: r[0].values.map((v) => ({
          id: Number(v[0]),
          status: String(v[1]),
        })),
        plans: r[1].values.map((v) => ({
          id: Number(v[0]),
          status: String(v[1]),
        })),
      };
    });

    expect(rows.tasks).toEqual([
      { id: 1, status: "completed" },
      { id: 2, status: "active" },
      { id: 3, status: "queued" },
    ]);
    expect(rows.plans).toEqual([
      { id: 1, status: "active" },
      { id: 2, status: "queued" },
    ]);
  });
});
