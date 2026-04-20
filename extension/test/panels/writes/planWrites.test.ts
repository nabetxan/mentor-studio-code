import { beforeEach, describe, expect, it } from "vitest";

import {
  activatePlan,
  addPlanToBacklog,
  changeStatus,
  createPlan,
  deactivatePlan,
  deletePlan,
  pausePlan,
  removePlan,
  restorePlan,
  setAsActivePlan,
  updatePlan,
} from "../../../src/panels/writes/planWrites";
import {
  makeEnvWithDb,
  mutateDb,
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

    it("demotes the active task when pausing its active plan", async () => {
      await mutateDb(env.paths.dbPath, (db) => {
        db.exec("UPDATE tasks SET status = 'active' WHERE id = 1");
      });

      await expect(
        pausePlan(env.paths.dbPath, 1, WASM),
      ).resolves.toBeUndefined();

      const t1Status = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT status FROM tasks WHERE id = 1");
        return r[0]?.values[0][0];
      });
      expect(t1Status).toBe("queued");
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

    it("demotes active task when moving its active plan to paused", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P-active",
          status: "active",
          sortOrder: 6,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 6, name: "T1", status: "active", sortOrder: 1 },
      ]);

      await expect(
        changeStatus(env.paths.dbPath, { id: 6, toStatus: "paused" }, WASM),
      ).resolves.toBeUndefined();

      const taskStatus = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT status FROM tasks WHERE planId = 6");
        return r[0]?.values[0][0];
      });
      expect(taskStatus).toBe("queued");
      expect((await readPlan(env.paths.dbPath, 6))?.status).toBe("paused");
    });
  });

  describe("setAsActivePlan", () => {
    it("creates new plan and activates when file is new and no active plan exists", async () => {
      const res = await setAsActivePlan(
        env.paths.dbPath,
        { name: "P1", filePath: "p1.md" },
        WASM,
      );
      expect(res.created).toBe(true);
      expect(res.activated).toBe(true);
      expect(res.demoted).toBe(false);
      expect(res.restored).toBe(false);
      expect((await readPlan(env.paths.dbPath, res.id))?.status).toBe("active");
    });

    it("demotes prior active to 'paused' (not 'queued') when activating a different file", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "prior",
          filePath: "prior.md",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);

      const res = await setAsActivePlan(
        env.paths.dbPath,
        { name: "new", filePath: "new.md" },
        WASM,
      );
      expect(res.created).toBe(true);
      expect(res.demoted).toBe(true);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("paused");
      expect((await readPlan(env.paths.dbPath, res.id))?.status).toBe("active");
    });

    it("no-op when the selected file is already the active plan", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P",
          filePath: "same.md",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);

      const res = await setAsActivePlan(
        env.paths.dbPath,
        { name: "P", filePath: "same.md" },
        WASM,
      );
      expect(res.created).toBe(false);
      expect(res.activated).toBe(false);
      expect(res.id).toBe(1);
      expect(await countPlans(env.paths.dbPath)).toBe(1);
    });

    it("reuses an existing queued plan instead of creating a duplicate", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "queued",
          filePath: "q.md",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);

      const res = await setAsActivePlan(
        env.paths.dbPath,
        { name: "queued", filePath: "q.md" },
        WASM,
      );
      expect(res.created).toBe(false);
      expect(res.activated).toBe(true);
      expect(res.id).toBe(1);
      expect(await countPlans(env.paths.dbPath)).toBe(1);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
    });

    it("restores a soft-deleted (removed) plan and activates it", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "ghost",
          filePath: "ghost.md",
          status: "removed",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);

      const res = await setAsActivePlan(
        env.paths.dbPath,
        { name: "ghost", filePath: "ghost.md" },
        WASM,
      );
      expect(res.created).toBe(false);
      expect(res.restored).toBe(true);
      expect(res.activated).toBe(true);
      expect(res.id).toBe(1);
      expect(await countPlans(env.paths.dbPath)).toBe(1);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
    });

    it("prefers a non-removed row when duplicates exist (picks lowest non-removed id)", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "dup-removed-old",
          filePath: "dup.md",
          status: "removed",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "dup-backlog",
          filePath: "dup.md",
          status: "backlog",
          sortOrder: 2,
          createdAt: "2026-04-02T00:00:00.000Z",
        },
      ]);

      const res = await setAsActivePlan(
        env.paths.dbPath,
        { name: "dup-backlog", filePath: "dup.md" },
        WASM,
      );
      // Non-removed (id=2) is preferred despite the removed row having a lower id.
      expect(res.id).toBe(2);
      expect(res.created).toBe(false);
      expect(res.restored).toBe(false);
    });
  });

  describe("addPlanToBacklog", () => {
    it("creates and auto-activates when no active plan exists", async () => {
      const res = await addPlanToBacklog(
        env.paths.dbPath,
        { name: "first", filePath: "first.md" },
        WASM,
      );
      expect(res.created).toBe(true);
      expect(res.activated).toBe(true);
      expect((await readPlan(env.paths.dbPath, res.id))?.status).toBe("active");
    });

    it("creates as backlog when an active plan already exists (no demotion)", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "prior",
          filePath: "prior.md",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);

      const res = await addPlanToBacklog(
        env.paths.dbPath,
        { name: "added", filePath: "added.md" },
        WASM,
      );
      expect(res.created).toBe(true);
      expect(res.activated).toBe(false);
      expect(res.demoted).toBe(false);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
      expect((await readPlan(env.paths.dbPath, res.id))?.status).toBe(
        "backlog",
      );
    });

    it("no-op when the file is already the active plan", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "A",
          filePath: "a.md",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);

      const res = await addPlanToBacklog(
        env.paths.dbPath,
        { name: "A", filePath: "a.md" },
        WASM,
      );
      expect(res.created).toBe(false);
      expect(res.activated).toBe(false);
      expect(res.id).toBe(1);
      expect(await countPlans(env.paths.dbPath)).toBe(1);
    });

    it("restores a removed plan back to backlog without activating if active plan exists", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "prior-active",
          filePath: "prior.md",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          name: "ghost",
          filePath: "ghost.md",
          status: "removed",
          sortOrder: 2,
          createdAt: "2026-04-02T00:00:00.000Z",
        },
      ]);

      const res = await addPlanToBacklog(
        env.paths.dbPath,
        { name: "ghost", filePath: "ghost.md" },
        WASM,
      );
      expect(res.created).toBe(false);
      expect(res.restored).toBe(true);
      expect(res.activated).toBe(false);
      expect(res.id).toBe(2);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
      expect((await readPlan(env.paths.dbPath, 2))?.status).toBe("backlog");
    });

    it("restores a removed plan AND activates when no active plan exists", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "ghost",
          filePath: "ghost.md",
          status: "removed",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);

      const res = await addPlanToBacklog(
        env.paths.dbPath,
        { name: "ghost", filePath: "ghost.md" },
        WASM,
      );
      expect(res.restored).toBe(true);
      expect(res.activated).toBe(true);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
    });

    it("activates an existing queued plan when no active plan exists (no-op otherwise)", async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "Q",
          filePath: "q.md",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);

      const res = await addPlanToBacklog(
        env.paths.dbPath,
        { name: "Q", filePath: "q.md" },
        WASM,
      );
      expect(res.created).toBe(false);
      expect(res.activated).toBe(true);
      expect((await readPlan(env.paths.dbPath, 1))?.status).toBe("active");
    });
  });
});
