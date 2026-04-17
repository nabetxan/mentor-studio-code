import { beforeEach, describe, expect, it } from "vitest";

import {
  activateTask,
  createTask,
  deleteTask,
  reorderTasks,
  updateTask,
} from "../../../src/panels/writes/taskWrites";
import {
  makeEnvWithDb,
  seedPlans,
  seedQuestions,
  seedTasks,
  seedTopics,
  WASM,
  withDb,
  type TestEnv,
} from "../../cli/helpers";

interface TaskRow {
  id: number;
  planId: number;
  name: string;
  status: string;
  sortOrder: number;
}

async function readTask(dbPath: string, id: number): Promise<TaskRow | null> {
  return withDb(dbPath, (db) => {
    const r = db.exec(
      `SELECT id, planId, name, status, sortOrder FROM tasks WHERE id = ${id}`,
    );
    const row = r[0]?.values?.[0];
    if (!row) return null;
    return {
      id: Number(row[0]),
      planId: Number(row[1]),
      name: String(row[2]),
      status: String(row[3]),
      sortOrder: Number(row[4]),
    };
  });
}

async function listTasks(dbPath: string): Promise<TaskRow[]> {
  return withDb(dbPath, (db) => {
    const r = db.exec(
      "SELECT id, planId, name, status, sortOrder FROM tasks ORDER BY id",
    );
    const values = r[0]?.values ?? [];
    return values.map((row) => ({
      id: Number(row[0]),
      planId: Number(row[1]),
      name: String(row[2]),
      status: String(row[3]),
      sortOrder: Number(row[4]),
    }));
  });
}

async function countTasks(dbPath: string): Promise<number> {
  return withDb(dbPath, (db) => {
    const r = db.exec("SELECT COUNT(*) FROM tasks");
    return Number(r[0].values[0][0]);
  });
}

describe("taskWrites", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
  });

  describe("createTask", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "queued",
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
    });

    it("per-plan sortOrder starts at 1 for each plan independently", async () => {
      const p1t1 = await createTask(
        env.paths.dbPath,
        { planId: 1, name: "P1-T1" },
        WASM,
      );
      const p1t2 = await createTask(
        env.paths.dbPath,
        { planId: 1, name: "P1-T2" },
        WASM,
      );
      const p2t1 = await createTask(
        env.paths.dbPath,
        { planId: 2, name: "P2-T1" },
        WASM,
      );

      const r1 = await readTask(env.paths.dbPath, p1t1.id);
      const r2 = await readTask(env.paths.dbPath, p1t2.id);
      const r3 = await readTask(env.paths.dbPath, p2t1.id);

      expect(r1?.sortOrder).toBe(1);
      expect(r2?.sortOrder).toBe(2);
      expect(r3?.sortOrder).toBe(1);
      expect(r1?.status).toBe("queued");
      expect(r1?.name).toBe("P1-T1");
    });

    it("throws when planId does not exist", async () => {
      await expect(
        createTask(env.paths.dbPath, { planId: 999, name: "X" }, WASM),
      ).rejects.toThrow("plan not found: 999");
    });
  });

  describe("updateTask", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "Original", status: "queued", sortOrder: 1 },
      ]);
    });

    it("name-only update", async () => {
      await updateTask(env.paths.dbPath, { id: 1, name: "Renamed" }, WASM);
      const row = await readTask(env.paths.dbPath, 1);
      expect(row?.name).toBe("Renamed");
      expect(row?.status).toBe("queued");
    });

    it("no-args call is a no-op on fields but still checks invariants", async () => {
      await updateTask(env.paths.dbPath, { id: 1 }, WASM);
      const row = await readTask(env.paths.dbPath, 1);
      expect(row?.name).toBe("Original");
    });

    it("not-found throws", async () => {
      await expect(
        updateTask(env.paths.dbPath, { id: 999, name: "X" }, WASM),
      ).rejects.toThrow("task not found: 999");
    });
  });

  describe("deleteTask", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "queued", sortOrder: 1 },
      ]);
    });

    it("happy path removes row", async () => {
      await deleteTask(env.paths.dbPath, { id: 1 }, WASM);
      expect(await countTasks(env.paths.dbPath)).toBe(0);
    });

    it("not-found throws", async () => {
      await expect(
        deleteTask(env.paths.dbPath, { id: 42 }, WASM),
      ).rejects.toThrow("task not found: 42");
    });

    it("questions FK violation throws", async () => {
      await seedTopics(env.paths.dbPath, ["topic-1"]);
      await seedQuestions(env.paths.dbPath, [
        {
          taskId: 1,
          topicId: 1,
          concept: "c",
          question: "q",
          userAnswer: "a",
          isCorrect: 1,
          lastAnsweredAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await expect(
        deleteTask(env.paths.dbPath, { id: 1 }, WASM),
      ).rejects.toThrow();
      // Task still exists (rolled back).
      expect(await countTasks(env.paths.dbPath)).toBe(1);
    });
  });

  describe("reorderTasks", () => {
    beforeEach(async () => {
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "queued",
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
        { planId: 1, name: "A", status: "queued", sortOrder: 1 },
        { planId: 1, name: "B", status: "queued", sortOrder: 2 },
        { planId: 1, name: "C", status: "queued", sortOrder: 3 },
        { planId: 2, name: "X", status: "queued", sortOrder: 1 },
      ]);
    });

    it("reorders 3 tasks correctly and leaves other plans untouched", async () => {
      // Original 1,2,3 for ids 1,2,3. Reorder to [3,1,2] -> ids 3=1, 1=2, 2=3.
      await reorderTasks(
        env.paths.dbPath,
        { planId: 1, orderedIds: [3, 1, 2] },
        WASM,
      );
      const t1 = await readTask(env.paths.dbPath, 1);
      const t2 = await readTask(env.paths.dbPath, 2);
      const t3 = await readTask(env.paths.dbPath, 3);
      expect(t3?.sortOrder).toBe(1);
      expect(t1?.sortOrder).toBe(2);
      expect(t2?.sortOrder).toBe(3);

      // Plan 2's task untouched.
      const t4 = await readTask(env.paths.dbPath, 4);
      expect(t4?.sortOrder).toBe(1);
      expect(t4?.planId).toBe(2);
    });

    it("throws when an id belongs to a different planId", async () => {
      // Task id 4 is in plan 2. Passing it with planId=1 should throw.
      await expect(
        reorderTasks(
          env.paths.dbPath,
          { planId: 1, orderedIds: [1, 4, 2] },
          WASM,
        ),
      ).rejects.toThrow("task 4 does not belong to plan 1");
    });

    it("throws when an id does not exist at all", async () => {
      await expect(
        reorderTasks(
          env.paths.dbPath,
          { planId: 1, orderedIds: [1, 999, 2] },
          WASM,
        ),
      ).rejects.toThrow("task not found: 999");
    });

    it("throws when planId does not exist", async () => {
      await expect(
        reorderTasks(
          env.paths.dbPath,
          { planId: 999, orderedIds: [1, 2, 3] },
          WASM,
        ),
      ).rejects.toThrow("plan not found: 999");
    });

    it("invariant violation (active task moved to wrong plan) does not occur for sort-only changes", async () => {
      // Sanity: reorder does not change planId, so invariants remain satisfied.
      await reorderTasks(
        env.paths.dbPath,
        { planId: 1, orderedIds: [1, 2, 3] },
        WASM,
      );
      const rows = await listTasks(env.paths.dbPath);
      expect(rows.length).toBe(4);
    });
  });

  describe("activateTask", () => {
    beforeEach(async () => {
      // Parent plan must be active for a task to be active (invariants).
      await seedPlans(env.paths.dbPath, [
        {
          name: "P1",
          status: "active",
          sortOrder: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ]);
      await seedTasks(env.paths.dbPath, [
        { planId: 1, name: "T1", status: "active", sortOrder: 1 },
        { planId: 1, name: "T2", status: "queued", sortOrder: 2 },
      ]);
    });

    it("previous active becomes queued, new id becomes active", async () => {
      await activateTask(env.paths.dbPath, { id: 2 }, WASM);
      expect((await readTask(env.paths.dbPath, 1))?.status).toBe("queued");
      expect((await readTask(env.paths.dbPath, 2))?.status).toBe("active");
    });

    it("activating currently-active task is idempotent", async () => {
      await activateTask(env.paths.dbPath, { id: 1 }, WASM);
      expect((await readTask(env.paths.dbPath, 1))?.status).toBe("active");
      expect((await readTask(env.paths.dbPath, 2))?.status).toBe("queued");
    });

    it("not-found throws", async () => {
      await expect(
        activateTask(env.paths.dbPath, { id: 999 }, WASM),
      ).rejects.toThrow("task not found: 999");
      // Original active task unchanged (rolled back).
      expect((await readTask(env.paths.dbPath, 1))?.status).toBe("active");
    });
  });
});
