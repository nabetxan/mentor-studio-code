import { beforeEach, describe, expect, it } from "vitest";

import { registerTasks } from "../../src/cli/commands/registerTasks";
import { updateTask } from "../../src/cli/commands/updateTask";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "./helpers";

describe("register-tasks", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await registerTasks(
      { planId: 1, names: ["Task 1"] },
      env.paths,
    );
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
    });

    it("registers ordered tasks and activates the first task for an active plan", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);

      const res = await registerTasks(
        { planId: 1, names: ["Task 1", "Task 2", "Task 3"] },
        env.paths,
      );

      expect(res).toMatchObject({
        ok: true,
        activatedTask: { id: 1, name: "Task 1", status: "active" },
      });
      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec(
          "SELECT id, name, status, sortOrder FROM tasks ORDER BY sortOrder ASC",
        );
        return r[0]?.values;
      });
      expect(rows).toEqual([
        [1, "Task 1", "active", 1],
        [2, "Task 2", "queued", 2],
        [3, "Task 3", "queued", 3],
      ]);
    });

    it("does not activate tasks for a non-active plan", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "backlog",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);

      const res = await registerTasks(
        { planId: 1, names: ["Task 1", "Task 2"] },
        env.paths,
      );

      expect(res).toMatchObject({ ok: true, activatedTask: null });
      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT status, sortOrder FROM tasks ORDER BY id ASC");
        return r[0]?.values;
      });
      expect(rows).toEqual([
        ["queued", 1],
        ["queued", 2],
      ]);
    });

    it("rejects registration when tasks already exist", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "Existing", status: "active", sortOrder: 1 },
      ]);

      const res = await registerTasks(
        { planId: 1, names: ["Task 1"] },
        env.paths,
      );

      expect(res).toMatchObject({ ok: false, error: "tasks_already_exist" });
    });

    it("is atomic when an invalid task name is supplied", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);

      const res = await registerTasks(
        { planId: 1, names: ["Task 1", ""] },
        env.paths,
      );

      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
      const count = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT COUNT(*) FROM tasks");
        return Number(r[0].values[0][0]);
      });
      expect(count).toBe(0);
    });

    it("rejects whitespace-only task names", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);

      const res = await registerTasks(
        { planId: 1, names: ["Task 1", "   "] },
        env.paths,
      );

      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
      const count = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT COUNT(*) FROM tasks");
        return Number(r[0].values[0][0]);
      });
      expect(count).toBe(0);
    });

    it("advances from Task 1 to Task 2 after ordered registration", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
      await registerTasks(
        { planId: 1, names: ["Task 1", "Task 2", "Task 3"] },
        env.paths,
      );

      const res = await updateTask({ id: 1, status: "completed" }, env.paths);

      expect(res).toMatchObject({
        ok: true,
        nextTask: { id: 2, name: "Task 2", planId: 1 },
        planCompleted: false,
      });
    });
  });
});
