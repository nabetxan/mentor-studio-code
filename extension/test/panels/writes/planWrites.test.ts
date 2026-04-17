import { beforeEach, describe, expect, it } from "vitest";

import {
  activatePlan,
  changeStatus,
  createPlan,
  deactivatePlan,
  deletePlan,
  pausePlan,
  removePlan,
  restorePlan,
  updatePlan,
} from "../../../src/panels/writes/planWrites";
import {
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  WASM,
  withDb,
  type TestEnv,
} from "../../cli/helpers";

async function readPlan(
  dbPath: string,
  id: number,
): Promise<{
  id: number;
  name: string;
  filePath: string | null;
  status: string;
  sortOrder: number;
} | null> {
  return withDb(dbPath, (db) => {
    const r = db.exec(
      `SELECT id, name, filePath, status, sortOrder FROM plans WHERE id = ${id}`,
    );
    const row = r[0]?.values?.[0];
    if (!row) return null;
    return {
      id: Number(row[0]),
      name: String(row[1]),
      filePath: row[2] === null ? null : String(row[2]),
      status: String(row[3]),
      sortOrder: Number(row[4]),
    };
  });
}

async function countPlans(dbPath: string): Promise<number> {
  return withDb(dbPath, (db) => {
    const r = db.exec("SELECT COUNT(*) FROM plans");
    return Number(r[0].values[0][0]);
  });
}

describe("planWrites", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
  });

  describe("createPlan", () => {
    it("first insert has sortOrder=1, second sortOrder=2", async () => {
      const a = await createPlan(
        env.paths.dbPath,
        { name: "P1", filePath: "/p1.md" },
        WASM,
      );
      const b = await createPlan(
        env.paths.dbPath,
        { name: "P2", filePath: "/p2.md" },
        WASM,
      );
      expect(a.id).toBe(1);
      expect(b.id).toBe(2);
      const p1 = await readPlan(env.paths.dbPath, a.id);
      const p2 = await readPlan(env.paths.dbPath, b.id);
      expect(p1?.sortOrder).toBe(1);
      expect(p2?.sortOrder).toBe(2);
      expect(p1?.status).toBe("backlog");
    });

    it("filePath can be null", async () => {
      const r = await createPlan(
        env.paths.dbPath,
        { name: "P", filePath: null },
        WASM,
      );
      const row = await readPlan(env.paths.dbPath, r.id);
      expect(row?.filePath).toBeNull();
      expect(row?.name).toBe("P");
    });
  });

  describe("updatePlan", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Original",
          filePath: "/orig.md",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
    });

    it("name-only update", async () => {
      await updatePlan(env.paths.dbPath, { id: 1, name: "Renamed" }, WASM);
      const row = await readPlan(env.paths.dbPath, 1);
      expect(row?.name).toBe("Renamed");
      expect(row?.filePath).toBe("/orig.md");
    });

    it("filePath-only update", async () => {
      await updatePlan(env.paths.dbPath, { id: 1, filePath: "/new.md" }, WASM);
      const row = await readPlan(env.paths.dbPath, 1);
      expect(row?.name).toBe("Original");
      expect(row?.filePath).toBe("/new.md");
    });

    it("filePath can be set to null", async () => {
      await updatePlan(env.paths.dbPath, { id: 1, filePath: null }, WASM);
      const row = await readPlan(env.paths.dbPath, 1);
      expect(row?.filePath).toBeNull();
    });

    it("no-op when neither name nor filePath provided", async () => {
      await updatePlan(env.paths.dbPath, { id: 1 }, WASM);
      const row = await readPlan(env.paths.dbPath, 1);
      expect(row?.name).toBe("Original");
      expect(row?.filePath).toBe("/orig.md");
    });

    it("not-found throws", async () => {
      await expect(
        updatePlan(env.paths.dbPath, { id: 999, name: "X" }, WASM),
      ).rejects.toThrow("plan not found: 999");
    });
  });

  describe("deletePlan", () => {
    it("happy path removes row", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await deletePlan(env.paths.dbPath, { id: 1 }, WASM);
      expect(await countPlans(env.paths.dbPath)).toBe(0);
    });

    it("not-found throws", async () => {
      await expect(
        deletePlan(env.paths.dbPath, { id: 42 }, WASM),
      ).rejects.toThrow("plan not found: 42");
    });

    it("tasks FK violation throws", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T", status: "queued", sortOrder: 1 },
      ]);
      await expect(
        deletePlan(env.paths.dbPath, { id: 1 }, WASM),
      ).rejects.toThrow("plan has dependents: 1 task(s)");
      // Plan still exists (rolled back).
      expect(await countPlans(env.paths.dbPath)).toBe(1);
    });
  });

  describe("activatePlan", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P2",
          status: "queued",
          sortOrder: 2,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      // Each plan needs at least one open task to satisfy
      // assertStatusInvariants (active plan must have an open task).
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "queued", sortOrder: 1 },
        { planId: 2, name: "T2", status: "queued", sortOrder: 1 },
      ]);
    });

    it("previous active becomes queued, new id becomes active", async () => {
      await activatePlan(env.paths.dbPath, { id: 2 }, WASM);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("queued");
      expect((await readPlan(env.paths.dbPath, 2))?.status).toBe("active");
    });

    it("activating currently-active plan is idempotent", async () => {
      await activatePlan(env.paths.dbPath, { id: 1 }, WASM);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
      expect((await readPlan(env.paths.dbPath, 2))?.status).toBe("queued");
    });

    it("not-found throws", async () => {
      await expect(
        activatePlan(env.paths.dbPath, { id: 999 }, WASM),
      ).rejects.toThrow("plan not found: 999");
      // Original active plan unchanged (rolled back).
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
    });
  });

  describe("pausePlan", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P2",
          status: "queued",
          sortOrder: 2,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "queued", sortOrder: 1 },
      ]);
    });

    it("pauses an active plan", async () => {
      await pausePlan(env.paths.dbPath, 1, WASM);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("paused");
    });

    it("pauses a queued plan (status becomes paused)", async () => {
      await pausePlan(env.paths.dbPath, 2, WASM);
      expect((await readPlan(env.paths.dbPath, 2))?.status).toBe("paused");
      // P1 (active) should remain unchanged
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
    });

    it("throws on missing id", async () => {
      await expect(pausePlan(env.paths.dbPath, 999, WASM)).rejects.toThrow(
        "plan not found: 999",
      );
    });

    it("status invariants hold after pausing active plan", async () => {
      // After pausing the only active plan, no active plan exists — invariants must still pass
      await expect(
        pausePlan(env.paths.dbPath, 1, WASM),
      ).resolves.toBeUndefined();
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("paused");
    });
  });

  describe("deactivatePlan", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P2",
          status: "queued",
          sortOrder: 2,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "queued", sortOrder: 1 },
      ]);
    });

    it("active becomes queued", async () => {
      await deactivatePlan(env.paths.dbPath, { id: 1 }, WASM);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("queued");
    });

    it("already-queued is no-op", async () => {
      await deactivatePlan(env.paths.dbPath, { id: 2 }, WASM);
      expect((await readPlan(env.paths.dbPath, 2))?.status).toBe("queued");
      // P1 unchanged.
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
    });

    it("not-found id is a no-op (idempotent)", async () => {
      await expect(
        deactivatePlan(env.paths.dbPath, { id: 999 }, WASM),
      ).resolves.toBeUndefined();
      // Existing active plan unchanged.
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
    });
  });

  describe("removePlan", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "backlog",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P2",
          status: "active",
          sortOrder: 2,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 2, name: "T1", status: "queued", sortOrder: 1 },
      ]);
    });

    it("backlog plan becomes removed", async () => {
      await removePlan(env.paths.dbPath, { id: 1 }, WASM);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("removed");
    });

    it("active plan throws cannot remove active plan", async () => {
      await expect(
        removePlan(env.paths.dbPath, { id: 2 }, WASM),
      ).rejects.toThrow("cannot remove active plan");
      // Plan unchanged.
      expect((await readPlan(env.paths.dbPath, 2))?.status).toBe("active");
    });
  });

  describe("restorePlan", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "removed",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P2",
          status: "backlog",
          sortOrder: 2,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
    });

    it("removed plan is restored to queued", async () => {
      await restorePlan(env.paths.dbPath, { id: 1, toStatus: "queued" }, WASM);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("queued");
    });

    it("non-removed plan is a no-op (status unchanged)", async () => {
      await restorePlan(env.paths.dbPath, { id: 2, toStatus: "queued" }, WASM);
      // Row was not removed so WHERE status='removed' matches nothing — backlog unchanged.
      expect((await readPlan(env.paths.dbPath, 2))?.status).toBe("backlog");
    });
  });

  describe("changeStatus", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P-queued",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P-paused",
          status: "paused",
          sortOrder: 2,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P-backlog",
          status: "backlog",
          sortOrder: 3,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P-completed",
          status: "completed",
          sortOrder: 4,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "P-removed",
          status: "removed",
          sortOrder: 5,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
    });

    it("queued → paused", async () => {
      await changeStatus(env.paths.dbPath, { id: 1, toStatus: "paused" }, WASM);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("paused");
    });

    it("queued → backlog", async () => {
      await changeStatus(
        env.paths.dbPath,
        { id: 1, toStatus: "backlog" },
        WASM,
      );
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("backlog");
    });

    it("queued → completed", async () => {
      await changeStatus(
        env.paths.dbPath,
        { id: 1, toStatus: "completed" },
        WASM,
      );
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("completed");
    });

    it("paused → queued", async () => {
      await changeStatus(env.paths.dbPath, { id: 2, toStatus: "queued" }, WASM);
      expect((await readPlan(env.paths.dbPath, 2))?.status).toBe("queued");
    });

    it("backlog → queued", async () => {
      await changeStatus(env.paths.dbPath, { id: 3, toStatus: "queued" }, WASM);
      expect((await readPlan(env.paths.dbPath, 3))?.status).toBe("queued");
    });

    it("completed → queued", async () => {
      await changeStatus(env.paths.dbPath, { id: 4, toStatus: "queued" }, WASM);
      expect((await readPlan(env.paths.dbPath, 4))?.status).toBe("queued");
    });

    it("removed → queued", async () => {
      await changeStatus(env.paths.dbPath, { id: 5, toStatus: "queued" }, WASM);
      expect((await readPlan(env.paths.dbPath, 5))?.status).toBe("queued");
    });

    it("removed → backlog", async () => {
      await changeStatus(
        env.paths.dbPath,
        { id: 5, toStatus: "backlog" },
        WASM,
      );
      expect((await readPlan(env.paths.dbPath, 5))?.status).toBe("backlog");
    });

    it("rejects toStatus='active'", async () => {
      await expect(
        changeStatus(
          env.paths.dbPath,
          { id: 1, toStatus: "active" as "queued" },
          WASM,
        ),
      ).rejects.toThrow("use activatePlan");
    });

    it("rejects toStatus='removed'", async () => {
      await expect(
        changeStatus(
          env.paths.dbPath,
          { id: 1, toStatus: "removed" as "queued" },
          WASM,
        ),
      ).rejects.toThrow("use removePlan");
    });

    it("not-found id throws", async () => {
      await expect(
        changeStatus(env.paths.dbPath, { id: 999, toStatus: "queued" }, WASM),
      ).rejects.toThrow("plan not found: 999");
    });
  });
});
