import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import { updateProfile } from "../../src/cli/commands/updateProfile";
import { loadSqlJs } from "../../src/db";
import { makeEnvWithDb, WASM, type TestEnv } from "./helpers";

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function readLatestProfile(dbPath: string): Promise<{
  experience: string;
  level: string;
  interests: string[];
  weak_areas: string[];
  mentor_style: string;
  last_updated: string;
} | null> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database(readFileSync(dbPath));
  try {
    const res = db.exec(
      "SELECT experience, level, interests, weakAreas, mentorStyle, lastUpdated FROM learner_profile ORDER BY lastUpdated DESC, id DESC LIMIT 1",
    )[0];
    if (!res || res.values.length === 0) return null;
    const [exp, lvl, inter, weak, style, lu] = res.values[0];
    return {
      experience: String(exp),
      level: String(lvl),
      interests: JSON.parse(String(inter)) as string[],
      weak_areas: JSON.parse(String(weak)) as string[],
      mentor_style: String(style),
      last_updated: String(lu),
    };
  } finally {
    db.close();
  }
}

async function countProfileRows(dbPath: string): Promise<number> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database(readFileSync(dbPath));
  try {
    return Number(
      db.exec("SELECT COUNT(*) FROM learner_profile")[0].values[0][0],
    );
  } finally {
    db.close();
  }
}

describe("update-profile (DB-backed)", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
  });

  it("each update inserts a new history row carrying full snapshot (partial update merges from latest)", async () => {
    await updateProfile(
      {
        experience: "5y",
        level: "intermediate",
        interests: ["web"],
        weak_areas: ["css"],
        mentor_style: "socratic",
      },
      env.paths,
    );
    expect(await countProfileRows(env.paths.dbPath)).toBe(1);

    const before = Date.now();
    const res = await updateProfile(
      { level: "senior", interests: ["web", "security"] },
      env.paths,
    );
    const after = Date.now();
    expect(res).toEqual({ ok: true });

    expect(await countProfileRows(env.paths.dbPath)).toBe(2);

    const latest = await readLatestProfile(env.paths.dbPath);
    expect(latest).not.toBeNull();
    expect(latest!.experience).toBe("5y");
    expect(latest!.level).toBe("senior");
    expect(latest!.interests).toEqual(["web", "security"]);
    expect(latest!.weak_areas).toEqual(["css"]);
    expect(latest!.mentor_style).toBe("socratic");
    expect(latest!.last_updated).toMatch(ISO_RE);
    const ts = Date.parse(latest!.last_updated);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("inserts the very first row when learner_profile is empty", async () => {
    expect(await countProfileRows(env.paths.dbPath)).toBe(0);

    const res = await updateProfile(
      {
        experience: "3y",
        level: "junior",
        interests: ["ts"],
        weak_areas: [],
        mentor_style: "direct",
      },
      env.paths,
    );
    expect(res).toEqual({ ok: true });

    expect(await countProfileRows(env.paths.dbPath)).toBe(1);
    const latest = await readLatestProfile(env.paths.dbPath);
    expect(latest!.experience).toBe("3y");
    expect(latest!.level).toBe("junior");
    expect(latest!.interests).toEqual(["ts"]);
    expect(latest!.weak_areas).toEqual([]);
    expect(latest!.mentor_style).toBe("direct");
    expect(latest!.last_updated).toMatch(ISO_RE);
  });

  it("defaults to empty values on first insert when caller provides only some fields", async () => {
    const res = await updateProfile({ level: "mid" }, env.paths);
    expect(res).toEqual({ ok: true });

    const latest = await readLatestProfile(env.paths.dbPath);
    expect(latest!.level).toBe("mid");
    expect(latest!.experience).toBe("");
    expect(latest!.interests).toEqual([]);
    expect(latest!.weak_areas).toEqual([]);
    expect(latest!.mentor_style).toBe("");
  });

  it("empty args still append a row that bumps lastUpdated (explicit 're-confirm profile' semantics)", async () => {
    await updateProfile({ experience: "old" }, env.paths);
    const first = await readLatestProfile(env.paths.dbPath);
    const firstTs = first!.last_updated;

    await new Promise((r) => setTimeout(r, 5));

    const res = await updateProfile({}, env.paths);
    expect(res).toEqual({ ok: true });

    expect(await countProfileRows(env.paths.dbPath)).toBe(2);
    const latest = await readLatestProfile(env.paths.dbPath);
    expect(latest!.experience).toBe("old");
    expect(latest!.last_updated).not.toBe(firstTs);
    expect(latest!.last_updated).toMatch(ISO_RE);
  });

  it("returns invalid_args when a string key is not a string", async () => {
    const res = await updateProfile({ experience: 5 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    expect(await countProfileRows(env.paths.dbPath)).toBe(0);
  });

  it("returns invalid_args when an array key is not an array", async () => {
    const res = await updateProfile({ interests: "web" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns invalid_args when array contains non-string elements", async () => {
    const res = await updateProfile({ weak_areas: ["css", 42] }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("ignores unknown keys", async () => {
    const res = await updateProfile(
      { level: "mid", bogus: "x" } as Record<string, unknown>,
      env.paths,
    );
    expect(res).toEqual({ ok: true });
    const latest = await readLatestProfile(env.paths.dbPath);
    expect(latest!.level).toBe("mid");
    expect(
      (latest as unknown as Record<string, unknown>).bogus,
    ).toBeUndefined();
  });

  it("returns db_write_failed when DB write errors (simulated by removing file)", async () => {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(env.paths.dbPath);
    const res = await updateProfile({ level: "mid" }, env.paths);
    expect(res).toMatchObject({ ok: false });
  });
});
