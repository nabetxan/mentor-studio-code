import { beforeEach, describe, expect, it } from "vitest";

import { deactivatePlan } from "../../src/cli/commands/deactivatePlan";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "./helpers";

describe("deactivate-plan", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await deactivatePlan({ id: 1 }, env.paths);
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
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "active", sortOrder: 1 },
      ]);
    });

    it("moves active plan to queued and demotes its active task", async () => {
      const res = await deactivatePlan({ id: 1 }, env.paths);
      expect(res).toEqual({ ok: true, id: 1 });
      const { planStatus, taskStatus } = await withDb(
        env.paths.dbPath,
        (db) => {
          const p = db.exec("SELECT status FROM plans WHERE id = 1");
          const t = db.exec("SELECT status FROM tasks WHERE planId = 1");
          return {
            planStatus: String(p[0]?.values?.[0]?.[0]),
            taskStatus: String(t[0]?.values?.[0]?.[0]),
          };
        },
      );
      expect(planStatus).toBe("queued");
      expect(taskStatus).toBe("queued");
    });

    it("is idempotent on non-active plans (no-op ok)", async () => {
      await deactivatePlan({ id: 1 }, env.paths);
      const res2 = await deactivatePlan({ id: 1 }, env.paths);
      expect(res2).toEqual({ ok: true, id: 1 });
    });

    it("rejects missing id", async () => {
      const res = await deactivatePlan({}, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-integer id", async () => {
      const res = await deactivatePlan({ id: "1" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });
  });
});
