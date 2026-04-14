import { beforeEach, describe, expect, it } from "vitest";

import { deletePlan } from "../../src/cli/commands/deletePlan";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  withDb,
  type TestEnv,
} from "./helpers";

describe("delete-plan", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await deletePlan({ id: 1 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
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
    });

    it("deletes a plan with no tasks", async () => {
      const res = await deletePlan({ id: 1 }, env.paths);
      expect(res).toEqual({ ok: true, id: 1 });
      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT id FROM plans ORDER BY id");
        return r[0] ? r[0].values.map((v) => Number(v[0])) : [];
      });
      expect(rows).toEqual([2]);
    });

    it("rejects missing id", async () => {
      const res = await deletePlan({}, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-integer id", async () => {
      const res = await deletePlan({ id: "1" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("returns not_found when id does not exist", async () => {
      const res = await deletePlan({ id: 999 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "not_found" });
    });

    it("returns invalid_state when plan has tasks (FK restrict)", async () => {
      await seedTasks(env.paths.dbPath, [
        { planId: 2, name: "T1", status: "queued", sortOrder: 1 },
      ]);
      const res = await deletePlan({ id: 2 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_state" });
    });
  });
});
