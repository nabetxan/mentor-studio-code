import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import { updateProgress } from "../../src/cli/commands/updateProgress";
import { loadSqlJs } from "../../src/db";
import { makeEnvWithDb, WASM, type TestEnv } from "./helpers";

async function readResumeContext(
  dbPath: string,
): Promise<string | null | undefined> {
  const SQL = await loadSqlJs(WASM);
  const db = new SQL.Database(readFileSync(dbPath));
  try {
    const res = db.exec(
      "SELECT value FROM app_state WHERE key='resume_context'",
    )[0];
    if (!res || res.values.length === 0) return undefined;
    const v = res.values[0][0];
    return v === null ? null : String(v);
  } finally {
    db.close();
  }
}

describe("update-progress (DB-backed)", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await makeEnvWithDb();
  });

  it("stores resume_context in app_state (upsert)", async () => {
    const res = await updateProgress({ resume_context: "ctx-B" }, env.paths);
    expect(res).toEqual({ ok: true });
    expect(await readResumeContext(env.paths.dbPath)).toBe("ctx-B");

    await updateProgress({ resume_context: "ctx-C" }, env.paths);
    expect(await readResumeContext(env.paths.dbPath)).toBe("ctx-C");
  });

  it("accepts null values for resume_context", async () => {
    await updateProgress({ resume_context: "first" }, env.paths);
    const res = await updateProgress({ resume_context: null }, env.paths);
    expect(res).toEqual({ ok: true });
    expect(await readResumeContext(env.paths.dbPath)).toBeNull();
  });

  it("returns invalid_args when resume_context is a number", async () => {
    const res = await updateProgress({ resume_context: 42 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("is a no-op when no known keys are provided", async () => {
    const res = await updateProgress({}, env.paths);
    expect(res).toEqual({ ok: true });
    expect(await readResumeContext(env.paths.dbPath)).toBeUndefined();
  });

  it("ignores unknown keys silently", async () => {
    const res = await updateProgress(
      { unknown: "x" } as Record<string, unknown>,
      env.paths,
    );
    expect(res).toEqual({ ok: true });
    expect(await readResumeContext(env.paths.dbPath)).toBeUndefined();
  });
});
