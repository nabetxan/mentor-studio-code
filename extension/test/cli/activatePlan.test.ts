import { beforeEach, describe, expect, it } from "vitest";

import { activatePlan } from "../../src/cli/commands/activatePlan";
import {
  makeEnv,
  makeEnvWithDb,
  mutateDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "./helpers";

describe("activate-plan", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await activatePlan({ id: 1 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "active",
          sortOrder: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          name: "P2",
          status: "queued",
          sortOrder: 2,
          createdAt: "2025-01-02T00:00:00.000Z",
        },
      ]);
      // Status invariant requires every active plan to have at least one
      // open task, and every plan must have at least one active task (or be
      // fully completed/skipped). Seed open tasks for both plans.
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "queued", sortOrder: 1 },
        { planId: 2, name: "T2", status: "queued", sortOrder: 1 },
      ]);
    });

    it("activates a queued plan and demotes currently active one", async () => {
      const res = await activatePlan({ id: 2 }, env.paths);
      expect(res).toEqual({ ok: true, id: 2, active: true });

      const statuses = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT id, status FROM plans ORDER BY id ASC");
        return r[0]?.values;
      });
      expect(statuses).toEqual([
        [1, "queued"],
        [2, "active"],
      ]);
    });

    it("cascades: activates the first queued task of the newly active plan", async () => {
      await activatePlan({ id: 2 }, env.paths);

      const taskStatuses = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec(
          "SELECT id, planId, status FROM tasks ORDER BY id ASC",
        );
        return r[0]?.values;
      });
      expect(taskStatuses).toEqual([
        [1, 1, "queued"],
        [2, 2, "active"],
      ]);
    });

    it("demotes the active task of the previously-active plan", async () => {
      // Promote T1 (planId=1) to active so the previously-active plan owns it.
      await mutateDb(env.paths.dbPath, (db) => {
        db.exec("UPDATE tasks SET status = 'active' WHERE id = 1");
      });

      const res = await activatePlan({ id: 2 }, env.paths);
      expect(res).toEqual({ ok: true, id: 2, active: true });

      const taskStatuses = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec(
          "SELECT id, planId, status FROM tasks ORDER BY id ASC",
        );
        return r[0]?.values;
      });
      // T1 must be demoted to keep the active-task-under-active-plan invariant.
      // T2 should be activated as the new plan's first queued task.
      expect(taskStatuses).toEqual([
        [1, 1, "queued"],
        [2, 2, "active"],
      ]);
    });

    it("deactivate demotes the active task under the deactivated plan", async () => {
      await mutateDb(env.paths.dbPath, (db) => {
        db.exec("UPDATE tasks SET status = 'active' WHERE id = 1");
      });

      const res = await activatePlan({ id: 1, deactivate: true }, env.paths);
      expect(res).toEqual({ ok: true, id: 1, active: false });

      const t1Status = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT status FROM tasks WHERE id = 1");
        return r[0]?.values[0][0];
      });
      expect(t1Status).toBe("queued");
    });

    it("deactivates an active plan when deactivate=true", async () => {
      const res = await activatePlan({ id: 1, deactivate: true }, env.paths);
      expect(res).toEqual({ ok: true, id: 1, active: false });

      const status = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT status FROM plans WHERE id = 1");
        return r[0]?.values[0][0];
      });
      expect(status).toBe("queued");
    });

    it("returns not_found when activating an unknown id", async () => {
      const res = await activatePlan({ id: 999 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "not_found" });
    });

    it("is idempotent on deactivate of unknown id", async () => {
      const res = await activatePlan({ id: 999, deactivate: true }, env.paths);
      expect(res).toEqual({ ok: true, id: 999, active: false });
    });

    it("is idempotent on deactivate of a queued id", async () => {
      const res = await activatePlan({ id: 2, deactivate: true }, env.paths);
      expect(res).toEqual({ ok: true, id: 2, active: false });
    });

    it("rejects missing id", async () => {
      const res = await activatePlan({}, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-integer id", async () => {
      const res = await activatePlan({ id: 1.5 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-boolean deactivate", async () => {
      const res = await activatePlan({ id: 1, deactivate: "yes" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });
  });
});
