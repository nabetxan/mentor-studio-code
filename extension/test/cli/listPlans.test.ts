import { beforeEach, describe, expect, it } from "vitest";

import { listPlans } from "../../src/cli/commands/listPlans";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  type TestEnv,
} from "./helpers";

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

    it("returns plans sorted by sortOrder ASC with taskCount and only the requested columns", async () => {
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
            taskCount: 0,
          },
          {
            id: 3,
            name: "Beta",
            filePath: null,
            status: "paused",
            sortOrder: 2,
            taskCount: 0,
          },
          {
            id: 1,
            name: "Gamma",
            filePath: null,
            status: "queued",
            sortOrder: 3,
            taskCount: 0,
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

    it("each plan includes taskCount reflecting actual task count", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "PlanA",
          filePath: null,
          status: "active",
          sortOrder: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          name: "PlanB",
          filePath: null,
          status: "queued",
          sortOrder: 2,
          createdAt: "2025-01-02T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "active", sortOrder: 1 },
        { planId: 1, name: "T2", status: "queued", sortOrder: 2 },
        { planId: 1, name: "T3", status: "completed", sortOrder: 3 },
      ]);

      const res = await listPlans({}, env.paths);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const plans = res.plans as Array<{ id: number; taskCount: number }>;
      const planA = plans.find((p) => p.id === 1);
      const planB = plans.find((p) => p.id === 2);
      expect(planA?.taskCount).toBe(3);
      expect(planB?.taskCount).toBe(0);
    });

    it("excludes removed plans by default", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Active",
          filePath: null,
          status: "active",
          sortOrder: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          name: "Removed",
          filePath: null,
          status: "removed",
          sortOrder: 2,
          createdAt: "2025-01-02T00:00:00.000Z",
        },
      ]);

      const res = await listPlans({}, env.paths);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const plans = res.plans as Array<{ name: string }>;
      expect(plans.map((p) => p.name)).not.toContain("Removed");
      expect(plans.map((p) => p.name)).toContain("Active");
    });

    it("includes removed plans when includeRemoved:true", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Active",
          filePath: null,
          status: "active",
          sortOrder: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          name: "Removed",
          filePath: null,
          status: "removed",
          sortOrder: 2,
          createdAt: "2025-01-02T00:00:00.000Z",
        },
      ]);

      const res = await listPlans({ includeRemoved: true }, env.paths);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const plans = res.plans as Array<{ name: string }>;
      expect(plans.map((p) => p.name)).toContain("Removed");
      expect(plans.map((p) => p.name)).toContain("Active");
    });

    it("excludes completed plans by default", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Active",
          filePath: null,
          status: "active",
          sortOrder: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          name: "Completed",
          filePath: null,
          status: "completed",
          sortOrder: 2,
          createdAt: "2025-01-02T00:00:00.000Z",
        },
      ]);

      const res = await listPlans({}, env.paths);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const plans = res.plans as Array<{ name: string }>;
      expect(plans.map((p) => p.name)).not.toContain("Completed");
      expect(plans.map((p) => p.name)).toContain("Active");
    });

    it("includes completed plans when includeCompleted:true", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Active",
          filePath: null,
          status: "active",
          sortOrder: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          name: "Completed",
          filePath: null,
          status: "completed",
          sortOrder: 2,
          createdAt: "2025-01-02T00:00:00.000Z",
        },
      ]);

      const res = await listPlans({ includeCompleted: true }, env.paths);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const plans = res.plans as Array<{ name: string }>;
      expect(plans.map((p) => p.name)).toContain("Completed");
      expect(plans.map((p) => p.name)).toContain("Active");
    });
  });
});
