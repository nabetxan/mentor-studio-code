import { beforeEach, describe, expect, it } from "vitest";

import { removePlan } from "../../src/cli/commands/removePlan";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  withDb,
  type TestEnv,
} from "./helpers";

describe("remove-plan", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await removePlan({ id: 1 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "backlog",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          name: "P2",
          status: "active",
          sortOrder: 2,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
    });

    it("moves backlog plan to removed", async () => {
      const res = await removePlan({ id: 1 }, env.paths);
      expect(res).toEqual({ ok: true, id: 1 });
      const status = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT status FROM plans WHERE id = 1");
        return String(r[0]?.values?.[0]?.[0]);
      });
      expect(status).toBe("removed");
    });

    it("active plan also moves to removed", async () => {
      const res = await removePlan({ id: 2 }, env.paths);
      expect(res).toEqual({ ok: true, id: 2 });
      const status = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT status FROM plans WHERE id = 2");
        return String(r[0]?.values?.[0]?.[0]);
      });
      expect(status).toBe("removed");
    });

    it("rejects missing id", async () => {
      const res = await removePlan({}, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-integer id", async () => {
      const res = await removePlan({ id: "1" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("returns not_found when id does not exist", async () => {
      const res = await removePlan({ id: 999 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "not_found" });
    });

    it("is idempotent-ish: removing already-removed plan is a no-op ok", async () => {
      await removePlan({ id: 1 }, env.paths);
      const res2 = await removePlan({ id: 1 }, env.paths);
      expect(res2).toMatchObject({ ok: true, id: 1 });
    });
  });
});
