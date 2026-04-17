import { beforeEach, describe, expect, it } from "vitest";

import { addPlan } from "../../src/cli/commands/addPlan";
import { makeEnv, makeEnvWithDb, withDb, type TestEnv } from "./helpers";

describe("add-plan", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await addPlan({ name: "P1" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
    });

    it("creates plan with null filePath by default", async () => {
      const res = await addPlan({ name: "Plan A" }, env.paths);
      expect(res).toEqual({
        ok: true,
        id: 1,
        name: "Plan A",
        filePath: null,
      });
    });

    it("creates plan with filePath when provided", async () => {
      const res = await addPlan(
        { name: "Plan B", filePath: "/tmp/p.md" },
        env.paths,
      );
      expect(res).toEqual({
        ok: true,
        id: 1,
        name: "Plan B",
        filePath: "/tmp/p.md",
      });

      const rows = await withDb(env.paths.dbPath, (db) => {
        const r = db.exec("SELECT name, filePath FROM plans WHERE id = 1");
        return r[0]?.values[0];
      });
      expect(rows?.[0]).toBe("Plan B");
      expect(rows?.[1]).toBe("/tmp/p.md");
    });

    it("assigns sequential ids", async () => {
      const r1 = await addPlan({ name: "P1" }, env.paths);
      const r2 = await addPlan({ name: "P2" }, env.paths);
      expect(r1).toMatchObject({ ok: true, id: 1 });
      expect(r2).toMatchObject({ ok: true, id: 2 });
    });

    it("rejects empty string name", async () => {
      const res = await addPlan({ name: "" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects missing name", async () => {
      const res = await addPlan({}, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-string name", async () => {
      const res = await addPlan({ name: 123 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-string/non-null filePath", async () => {
      const res = await addPlan({ name: "P", filePath: 42 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });
  });
});
