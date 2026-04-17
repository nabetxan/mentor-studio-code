import { beforeEach, describe, expect, it } from "vitest";

import { addTask } from "../../src/cli/commands/addTask";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "./helpers";

describe("add-task", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await addTask({ planId: 1, name: "T1" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
    });

    it("happy path: creates task and returns id", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
      const res = await addTask({ planId: 1, name: "Task 1" }, env.paths);
      expect(res).toMatchObject({ ok: true, id: 1 });
    });

    it("auto-activates the first task under an active plan", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
      const r1 = await addTask({ planId: 1, name: "Task 1" }, env.paths);
      const r2 = await addTask({ planId: 1, name: "Task 2" }, env.paths);
      expect(r1).toMatchObject({ ok: true, id: 1, activated: true });
      expect(r2).toMatchObject({ ok: true, id: 2, activated: false });

      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT id, status FROM tasks ORDER BY id ASC");
        return r[0]?.values;
      });
      expect(rows).toEqual([
        [1, "active"],
        [2, "queued"],
      ]);
    });

    it("does not auto-activate when the plan is not active", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Plan A",
          status: "backlog",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
      const res = await addTask({ planId: 1, name: "Task 1" }, env.paths);
      expect(res).toMatchObject({ ok: true, id: 1, activated: false });

      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT id, status FROM tasks ORDER BY id ASC");
        return r[0]?.values;
      });
      expect(rows).toEqual([[1, "queued"]]);
    });

    it("does not auto-activate when an active task already exists", async () => {
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
      const res = await addTask({ planId: 1, name: "Task 2" }, env.paths);
      expect(res).toMatchObject({ ok: true, id: 2, activated: false });

      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT id, status FROM tasks ORDER BY id ASC");
        return r[0]?.values;
      });
      expect(rows).toEqual([
        [1, "active"],
        [2, "queued"],
      ]);
    });

    it("returns plan_not_found for bogus planId", async () => {
      const res = await addTask({ planId: 999, name: "T1" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "plan_not_found" });
    });

    it("returns invalid_args when planId is missing", async () => {
      const res = await addTask({ name: "T1" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("returns invalid_args when planId is a string", async () => {
      const res = await addTask({ planId: "1", name: "T1" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("returns invalid_args when planId is a float", async () => {
      const res = await addTask({ planId: 1.5, name: "T1" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("returns invalid_args when name is missing", async () => {
      const res = await addTask({ planId: 1 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("returns invalid_args when name is empty string", async () => {
      const res = await addTask({ planId: 1, name: "" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("returns invalid_args when name is a number", async () => {
      const res = await addTask({ planId: 1, name: 42 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });
  });
});
