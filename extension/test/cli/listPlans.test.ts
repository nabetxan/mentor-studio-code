import { beforeEach, describe, expect, it } from "vitest";

import { listPlans } from "../../src/cli/commands/listPlans";
import { makeEnv, makeEnvWithDb, seedPlans, type TestEnv } from "./helpers";

describe("list-plans", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await listPlans({}, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
    });

    it("returns empty plans list when no rows", async () => {
      const res = await listPlans({}, env.paths);
      expect(res).toEqual({ ok: true, plans: [] });
    });

    it("returns plans sorted by sortOrder ASC and only the requested columns", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Gamma",
          filePath: null,
          status: "queued",
          sortOrder: 3,
          createdAt: "2025-01-03T00:00:00.000Z",
        },
        {
          name: "Alpha",
          filePath: "/tmp/a.md",
          status: "active",
          sortOrder: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          name: "Beta",
          filePath: null,
          status: "paused",
          sortOrder: 2,
          createdAt: "2025-01-02T00:00:00.000Z",
        },
      ]);

      const res = await listPlans({}, env.paths);
      expect(res).toEqual({
        ok: true,
        plans: [
          {
            id: 2,
            name: "Alpha",
            filePath: "/tmp/a.md",
            status: "active",
            sortOrder: 1,
          },
          {
            id: 3,
            name: "Beta",
            filePath: null,
            status: "paused",
            sortOrder: 2,
          },
          {
            id: 1,
            name: "Gamma",
            filePath: null,
            status: "queued",
            sortOrder: 3,
          },
        ],
      });

      // Ensure createdAt is not leaked
      if (res.ok) {
        const plans = res.plans as Array<Record<string, unknown>>;
        for (const p of plans) {
          expect(p).not.toHaveProperty("createdAt");
        }
      }
    });
  });
});
