import { beforeEach, describe, expect, it } from "vitest";

import { listTopics } from "../../src/cli/commands/listTopics";
import { makeEnv, makeEnvWithDb, seedTopics, type TestEnv } from "./helpers";

describe("list-topics", () => {
  let env: TestEnv;

  it("returns db_missing when DB file does not exist", async () => {
    env = makeEnv();
    const res = await listTopics(undefined, env.paths);
    expect(res).toMatchObject({ ok: false, error: "db_missing" });
  });

  describe("with DB", () => {
    beforeEach(async () => {
      env = await makeEnvWithDb();
    });

    it("returns empty array when no topics", async () => {
      const res = await listTopics(undefined, env.paths);
      expect(res).toEqual({ ok: true, topics: [] });
    });

    it("returns topics ordered by id ASC", async () => {
      await seedTopics(env.paths.dbPath, ["B", "A", "C"]);
      const res = await listTopics(undefined, env.paths);
      expect(res).toEqual({
        ok: true,
        topics: [
          { id: 1, label: "B" },
          { id: 2, label: "A" },
          { id: 3, label: "C" },
        ],
      });
    });

    it("allows duplicate labels with distinct ids", async () => {
      await seedTopics(env.paths.dbPath, ["Dup", "Dup"]);
      const res = await listTopics(undefined, env.paths);
      expect(res).toEqual({
        ok: true,
        topics: [
          { id: 1, label: "Dup" },
          { id: 2, label: "Dup" },
        ],
      });
    });
  });
});
