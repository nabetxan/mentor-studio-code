import { beforeEach, describe, expect, it } from "vitest";

import { updateTask } from "../../src/cli/commands/updateTask";
import {
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "./helpers";

async function readPlanStatus(dbPath: string, id: number): Promise<string> {
  return withDb(dbPath, (db) => {
    const r = db.exec(`SELECT status FROM plans WHERE id = ${id}`);
    return String(r[0].values[0][0]);
  });
}

async function readTaskStatus(dbPath: string, id: number): Promise<string> {
  return withDb(dbPath, (db) => {
    const r = db.exec(`SELECT status FROM tasks WHERE id = ${id}`);
    return String(r[0].values[0][0]);
  });
}

describe("update-task", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
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
      { planId: 1, name: "T2", status: "queued", sortOrder: 1 },
    ]);
  });

  it("returns invalid_args when id missing", async () => {
    const res = await updateTask({ status: "completed" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns invalid_args for status='active'", async () => {
    const res = await updateTask({ id: 1, status: "active" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns invalid_args for status='queued'", async () => {
    const res = await updateTask({ id: 1, status: "queued" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns not_found for non-existent id", async () => {
    const res = await updateTask({ id: 999, status: "completed" }, env.paths);
    expect(res).toEqual({ ok: false, error: "not_found" });
  });

  it("advances to next queued task", async () => {
    const res = await updateTask({ id: 1, status: "completed" }, env.paths);
    expect(res).toEqual({
      ok: true,
      nextTask: { id: 2, name: "T2", planId: 1 },
      planCompleted: false,
    });

    expect(await readTaskStatus(env.paths.dbPath, 1)).toBe("completed");
    expect(await readTaskStatus(env.paths.dbPath, 2)).toBe("active");
  });

  it("skipped status also advances", async () => {
    const res = await updateTask({ id: 1, status: "skipped" }, env.paths);
    expect(res).toMatchObject({
      ok: true,
      nextTask: { id: 2 },
      planCompleted: false,
    });
    expect(await readTaskStatus(env.paths.dbPath, 1)).toBe("skipped");
    expect(await readTaskStatus(env.paths.dbPath, 2)).toBe("active");
  });

  it("marks plan completed when no more queued tasks", async () => {
    await updateTask({ id: 1, status: "completed" }, env.paths);
    const res = await updateTask({ id: 2, status: "completed" }, env.paths);
    expect(res).toEqual({ ok: true, nextTask: null, planCompleted: true });

    expect(await readPlanStatus(env.paths.dbPath, 1)).toBe("completed");
  });

  it("is a no-op on an already-completed task, reporting current active task", async () => {
    await updateTask({ id: 1, status: "completed" }, env.paths);
    const res = await updateTask({ id: 1, status: "completed" }, env.paths);
    expect(res).toEqual({
      ok: true,
      nextTask: { id: 2, name: "T2", planId: 1 },
      planCompleted: false,
    });
    expect(await readTaskStatus(env.paths.dbPath, 1)).toBe("completed");
    expect(await readTaskStatus(env.paths.dbPath, 2)).toBe("active");
  });

  it("is a no-op when all tasks are done and plan is already completed", async () => {
    await updateTask({ id: 1, status: "completed" }, env.paths);
    await updateTask({ id: 2, status: "completed" }, env.paths);
    const res = await updateTask({ id: 2, status: "completed" }, env.paths);
    expect(res).toEqual({ ok: true, nextTask: null, planCompleted: true });
    expect(await readPlanStatus(env.paths.dbPath, 1)).toBe("completed");
  });

  it("returns invalid_state when target task is queued (not active)", async () => {
    const res = await updateTask({ id: 2, status: "completed" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_state" });
    // Rolled back: both tasks unchanged.
    expect(await readTaskStatus(env.paths.dbPath, 1)).toBe("active");
    expect(await readTaskStatus(env.paths.dbPath, 2)).toBe("queued");
  });

  it("returns invariant_violation when autoAdvance would break invariants", async () => {
    const env2 = await makeEnvWithDb();
    await seedPlans(env2.paths.dbPath, [
      {
        name: "P1",
        status: "queued",
        sortOrder: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    // Seed an already-inconsistent state (active task under a queued plan).
    // update-task will try to auto-advance which trips assertStatusInvariants.
    await seedTasks(env2.paths.dbPath, [
      { planId: 1, name: "T1", status: "active", sortOrder: 0 },
      { planId: 1, name: "T2", status: "queued", sortOrder: 1 },
    ]);

    const res = await updateTask({ id: 1, status: "completed" }, env2.paths);
    expect(res).toMatchObject({ ok: false, error: "invariant_violation" });
    // Rolled back: task1 remains active, task2 remains queued.
    expect(await readTaskStatus(env2.paths.dbPath, 1)).toBe("active");
    expect(await readTaskStatus(env2.paths.dbPath, 2)).toBe("queued");
  });
});
