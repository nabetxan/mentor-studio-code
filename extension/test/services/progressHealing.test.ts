import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selfHealProgress } from "../../src/services/progressHealing";
import {
  makeEnvWithDb,
  seedPlans,
  seedTasks,
  WASM,
  writeProgress,
} from "../cli/helpers";

describe("selfHealProgress", () => {
  it("sets current_task to null when DB has no active task", async () => {
    const env = await makeEnvWithDb([]);
    writeProgress(env.paths.progressPath, { current_task: 3 });
    const r = await selfHealProgress(
      env.paths.dbPath,
      env.paths.progressPath,
      WASM,
    );
    expect(r.changed).toBe(true);
    expect(r.to).toBeNull();
    const after = JSON.parse(readFileSync(env.paths.progressPath, "utf-8"));
    expect(after.current_task).toBeNull();
  });

  it("sets current_task to DB active task id when out of sync", async () => {
    const env = await makeEnvWithDb([]);
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "active",
        sortOrder: 1,
        createdAt: "2026-04-13T00:00:00Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "Build", status: "active", sortOrder: 1 },
    ]);
    writeProgress(env.paths.progressPath, { current_task: null });
    const r = await selfHealProgress(
      env.paths.dbPath,
      env.paths.progressPath,
      WASM,
    );
    expect(r.changed).toBe(true);
    expect(r.to).toBe(1);
  });

  it("no-ops when already in sync", async () => {
    const env = await makeEnvWithDb([]);
    writeProgress(env.paths.progressPath, { current_task: null });
    const r = await selfHealProgress(
      env.paths.dbPath,
      env.paths.progressPath,
      WASM,
    );
    expect(r.changed).toBe(false);
  });

  it("creates progress.json if missing but DB has active task", async () => {
    const env = await makeEnvWithDb([]);
    await seedPlans(env.paths.dbPath, [
      {
        name: "P1",
        status: "active",
        sortOrder: 1,
        createdAt: "2026-04-13T00:00:00Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "T", status: "active", sortOrder: 1 },
    ]);
    const r = await selfHealProgress(
      env.paths.dbPath,
      env.paths.progressPath,
      WASM,
    );
    expect(r.changed).toBe(true);
    expect(r.to).toBe(1);
    const p = JSON.parse(readFileSync(env.paths.progressPath, "utf-8"));
    expect(p.current_task).toBe(1);
  });

  it("does not overwrite malformed progress.json", async () => {
    const env = await makeEnvWithDb([]);
    writeFileSync(env.paths.progressPath, "{ not json");
    const r = await selfHealProgress(
      env.paths.dbPath,
      env.paths.progressPath,
      WASM,
    );
    expect(r.changed).toBe(false);
    expect(r.to).toBe(null);
    expect(r.reason).toBe("malformed");
    expect(readFileSync(env.paths.progressPath, "utf-8")).toBe("{ not json");
  });

  it("does not overwrite non-object progress.json (array/null)", async () => {
    const env = await makeEnvWithDb([]);
    writeFileSync(env.paths.progressPath, "[]");
    const r = await selfHealProgress(
      env.paths.dbPath,
      env.paths.progressPath,
      WASM,
    );
    // active is null and beforeNum is null (because parsed is non-object → default),
    // so no write happens.
    expect(r.changed).toBe(false);
    expect(readFileSync(env.paths.progressPath, "utf-8")).toBe("[]");
  });

  it("returns no-change when DB missing", async () => {
    const env = await makeEnvWithDb([]);
    writeFileSync(
      env.paths.progressPath,
      JSON.stringify({ current_task: null }),
    );
    const nonexistent = env.paths.dbPath + ".none";
    const r = await selfHealProgress(nonexistent, env.paths.progressPath, WASM);
    expect(r.changed).toBe(false);
  });
});
