import { beforeEach, describe, expect, it } from "vitest";

import { addTopic } from "../../src/cli/commands/addTopic";
import { makeEnv, makeEnvWithDb, withDb, type TestEnv } from "./helpers";

describe("add-topic", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await addTopic({ label: "X" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
    });

    it("assigns sequential ids", async () => {
      const r1 = await addTopic({ label: "HTML" }, env.paths);
      const r2 = await addTopic({ label: "CSS" }, env.paths);
      expect(r1).toEqual({ ok: true, id: 1, label: "HTML" });
      expect(r2).toEqual({ ok: true, id: 2, label: "CSS" });
    });

    it("allows duplicate labels with distinct ids", async () => {
      const r1 = await addTopic({ label: "Dup" }, env.paths);
      const r2 = await addTopic({ label: "Dup" }, env.paths);
      expect(r1).toEqual({ ok: true, id: 1, label: "Dup" });
      expect(r2).toEqual({ ok: true, id: 2, label: "Dup" });

      const rows = await withDb(env.paths.dbPath, (db) => {
        const res = db.exec("SELECT id, label FROM topics ORDER BY id ASC");
        return res[0]
          ? res[0].values.map((r) => ({
              id: Number(r[0]),
              label: String(r[1]),
            }))
          : [];
      });
      expect(rows).toEqual([
        { id: 1, label: "Dup" },
        { id: 2, label: "Dup" },
      ]);
    });

    it("rejects empty string label", async () => {
      const res = await addTopic({ label: "" }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects non-string label", async () => {
      const res = await addTopic({ label: 123 }, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });

    it("rejects missing label", async () => {
      const res = await addTopic({}, env.paths);
      expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    });
  });
});
