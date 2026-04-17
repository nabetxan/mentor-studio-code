import { beforeEach, describe, expect, it } from "vitest";

import { activateTask } from "../../src/cli/commands/activateTask";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "./helpers";

describe("activate-task", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await activateTask({ id: 1 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  it("rejects missing id", async () => {
    env = await makeEnvWithDb();
    const res = await activateTask({}, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("rejects non-integer id", async () => {
    env = await makeEnvWithDb();
    const res = await activateTask({ id: 1.5 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
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
        {
          name: "P2",
          status: "queued",
          sortOrder: 2,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "queued", sortOrder: 1 },
        { planId: 1, name: "T2", status: "queued", sortOrder: 2 },
        { planId: 2, name: "T3", status: "queued", sortOrder: 1 },
      ]);
    });

    it("returns not_found for unknown id", async () => {
      const res = await activateTask({ id: 999 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "not_found" });
    });

    it("activates a queued task in the active plan", async () => {
      const res = await activateTask({ id: 1 }, env.paths);
      expect(res).toEqual({ ok: true, id: 1, active: true });

      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT id, status FROM tasks ORDER BY id ASC");
        return r[0]?.values;
      });
      expect(rows).toEqual([
        [1, "active"],
        [2, "queued"],
        [3, "queued"],
      ]);
    });

    it("demotes the previous active task when switching", async () => {
      await activateTask({ id: 1 }, env.paths);
      const res = await activateTask({ id: 2 }, env.paths);
      expect(res).toEqual({ ok: true, id: 2, active: true });

      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT id, status FROM tasks ORDER BY id ASC");
        return r[0]?.values;
      });
      expect(rows).toEqual([
        [1, "queued"],
        [2, "active"],
        [3, "queued"],
      ]);
    });

    it("rejects activating a task in a non-active plan", async () => {
      const res = await activateTask({ id: 3 }, env.paths);
      expect(res).toMatchObject({
        ok: false,
        error: "invariant_violation",
      });

      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT id, status FROM tasks ORDER BY id ASC");
        return r[0]?.values;
      });
      expect(rows).toEqual([
        [1, "queued"],
        [2, "queued"],
        [3, "queued"],
      ]);
    });
  });
});
