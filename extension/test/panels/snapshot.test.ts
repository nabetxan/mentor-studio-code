import { beforeEach, describe, expect, it } from "vitest";
import { readSnapshot } from "../../src/panels/snapshot";
import {
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  seedTopics,
  WASM,
  type TestEnv,
} from "../cli/helpers";

describe("readSnapshot", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
  });

  it("returns empty arrays when DB has no data", async () => {
    const snapshot = await readSnapshot(env.paths.dbPath, WASM);
    expect(snapshot.plans).toEqual([]);
    expect(snapshot.tasks).toEqual([]);
    expect(snapshot.topics).toEqual([]);
  });

  it("returns plans ordered by sortOrder ASC", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "B",
        status: "queued",
        sortOrder: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        name: "A",
        status: "queued",
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const snapshot = await readSnapshot(env.paths.dbPath, WASM);
    expect(snapshot.plans).toHaveLength(2);
    expect(snapshot.plans[0]?.name).toBe("A");
    expect(snapshot.plans[0]?.sortOrder).toBe(1);
    expect(snapshot.plans[1]?.name).toBe("B");
    expect(snapshot.plans[1]?.sortOrder).toBe(2);
  });

  it("plan shape includes all required fields", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        filePath: "/p1.md",
        status: "active",
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    // Need a queued task for active plan invariant
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T1", status: "queued", sortOrder: 1 },
    ]);

    const snapshot = await readSnapshot(env.paths.dbPath, WASM);
    const plan = snapshot.plans[0];
    expect(plan).toBeDefined();
    expect(plan?.id).toBe(1);
    expect(plan?.name).toBe("P1");
    expect(plan?.filePath).toBe("/p1.md");
    expect(plan?.status).toBe("active");
    expect(plan?.sortOrder).toBe(1);
  });

  it("plan with null filePath is represented correctly", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        filePath: null,
        status: "queued",
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const snapshot = await readSnapshot(env.paths.dbPath, WASM);
    expect(snapshot.plans[0]?.filePath).toBeNull();
  });

  it("returns tasks ordered by planId then sortOrder ASC", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "queued",
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        name: "P2",
        status: "queued",
        sortOrder: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 2, name: "P2-T1", status: "queued", sortOrder: 1 },
      { planId: 1, name: "P1-T2", status: "queued", sortOrder: 2 },
      { planId: 1, name: "P1-T1", status: "queued", sortOrder: 1 },
    ]);

    const snapshot = await readSnapshot(env.paths.dbPath, WASM);
    expect(snapshot.tasks).toHaveLength(3);
    // planId 1 comes before planId 2
    expect(snapshot.tasks[0]?.planId).toBe(1);
    expect(snapshot.tasks[0]?.sortOrder).toBe(1);
    expect(snapshot.tasks[0]?.name).toBe("P1-T1");
    expect(snapshot.tasks[1]?.planId).toBe(1);
    expect(snapshot.tasks[1]?.sortOrder).toBe(2);
    expect(snapshot.tasks[2]?.planId).toBe(2);
  });

  it("task shape includes all required fields", async () => {
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "queued",
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "My Task", status: "completed", sortOrder: 3 },
    ]);

    const snapshot = await readSnapshot(env.paths.dbPath, WASM);
    const task = snapshot.tasks[0];
    expect(task).toBeDefined();
    expect(task?.id).toBe(1);
    expect(task?.planId).toBe(1);
    expect(task?.name).toBe("My Task");
    expect(task?.status).toBe("completed");
    expect(task?.sortOrder).toBe(3);
  });

  it("returns topics ordered by id and keys as t_<id>", async () => {
    await seedTopics(env.paths.dbPath, ["TypeScript", "React", "Node"]);

    const snapshot = await readSnapshot(env.paths.dbPath, WASM);
    expect(snapshot.topics).toHaveLength(3);
    expect(snapshot.topics[0]?.key).toBe("t_1");
    expect(snapshot.topics[0]?.label).toBe("TypeScript");
    expect(snapshot.topics[1]?.key).toBe("t_2");
    expect(snapshot.topics[1]?.label).toBe("React");
    expect(snapshot.topics[2]?.key).toBe("t_3");
    expect(snapshot.topics[2]?.label).toBe("Node");
  });

  it("returns all three collections simultaneously", async () => {
    await seedTopics(env.paths.dbPath, ["Topic A"]);
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "queued",
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T1", status: "queued", sortOrder: 1 },
    ]);

    const snapshot = await readSnapshot(env.paths.dbPath, WASM);
    expect(snapshot.plans).toHaveLength(1);
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.topics).toHaveLength(1);
  });
});
