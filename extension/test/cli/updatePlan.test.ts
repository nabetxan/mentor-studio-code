import { beforeEach, describe, expect, it } from "vitest";

import { updatePlan } from "../../src/cli/commands/updatePlan";
import {
  makeEnv,
  makeEnvWithDb,
  seedPlans,
  withDb,
  type TestEnv,
} from "./helpers";

describe("update-plan", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await updatePlan({ id: 1, name: "X" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
      await seedPlans(env.paths.dbPath, [
        {
          name: "Original",
          filePath: "/orig.md",
          status: "queued",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
    });

    it("updates name only", async () => {
      const res = await updatePlan({ id: 1, name: "Renamed" }, env.paths);
      expect(res).toEqual({ ok: true, id: 1 });
      const row = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT name, filePath FROM plans WHERE id = 1");
        return r[0]?.values[0];
      });
      expect(row?.[0]).toBe("Renamed");
      expect(row?.[1]).toBe("/orig.md");
    });

    it("updates filePath to a string", async () => {
      const res = await updatePlan({ id: 1, filePath: "/new.md" }, env.paths);
      expect(res).toEqual({ ok: true, id: 1 });
      const row = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT name, filePath FROM plans WHERE id = 1");
        return r[0]?.values[0];
      });
      expect(row?.[0]).toBe("Original");
      expect(row?.[1]).toBe("/new.md");
    });

    it("updates filePath to null", async () => {
      const res = await updatePlan({ id: 1, filePath: null }, env.paths);
      expect(res).toEqual({ ok: true, id: 1 });
      const row = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT filePath FROM plans WHERE id = 1");
        return r[0]?.values[0];
      });
      expect(row?.[0]).toBeNull();
    });

    it("rejects when no updateable fields given", async () => {
      const res = await updatePlan({ id: 1 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects missing id", async () => {
      const res = await updatePlan({ name: "X" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-integer id", async () => {
      const res = await updatePlan({ id: "1", name: "X" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-string name", async () => {
      const res = await updatePlan({ id: 1, name: 42 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects empty name", async () => {
      const res = await updatePlan({ id: 1, name: "" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-string/non-null filePath", async () => {
      const res = await updatePlan({ id: 1, filePath: 42 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("returns not_found when id does not exist", async () => {
      const res = await updatePlan({ id: 999, name: "X" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "not_found" });
    });
  });
});
