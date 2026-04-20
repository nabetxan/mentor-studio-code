import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { bootstrapDb, loadSqlJs } from "../../src/db";
import {
  cleanupOrphanProgressJson,
  migrateToV2,
} from "../../src/migration/v2ProfileAppState";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

describe("migrateToV2", () => {
  let dir: string;
  let dbPath: string;
  let progressPath: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "v2mig-"));
    dbPath = join(dir, "data.db");
    progressPath = join(dir, "progress.json");
    await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    db.exec("DROP TABLE IF EXISTS learner_profile");
    db.exec("DROP TABLE IF EXISTS app_state");
    db.exec("PRAGMA user_version = 1");
    writeFileSync(dbPath, Buffer.from(db.export()));
    db.close();
  });

  it("migrates progress.json into learner_profile (1 row) + app_state, writes .bak, deletes progress.json", async () => {
    writeFileSync(
      progressPath,
      JSON.stringify({
        resume_context: "hello",
        learner_profile: {
          experience: "3y",
          level: "intermediate",
          interests: ["ts", "backend"],
          weak_areas: ["css"],
          mentor_style: "hints",
          last_updated: "2026-04-18T00:00:00.000Z",
        },
      }),
    );

    const res = await migrateToV2(dir, WASM);
    expect(res.ok).toBe(true);

    expect(existsSync(progressPath)).toBe(false);
    expect(existsSync(`${progressPath}.bak`)).toBe(true);

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));

    const version = Number(db.exec("PRAGMA user_version")[0].values[0][0]);
    expect(version).toBe(2);

    expect(
      Number(db.exec("SELECT COUNT(*) FROM learner_profile")[0].values[0][0]),
    ).toBe(1);

    const profile = db.exec(
      "SELECT experience, level, interests, weakAreas, mentorStyle, lastUpdated FROM learner_profile ORDER BY lastUpdated DESC, id DESC LIMIT 1",
    )[0];
    expect(profile.values[0]).toEqual([
      "3y",
      "intermediate",
      JSON.stringify(["ts", "backend"]),
      JSON.stringify(["css"]),
      "hints",
      "2026-04-18T00:00:00.000Z",
    ]);

    const rc = db.exec(
      "SELECT value FROM app_state WHERE key='resume_context'",
    )[0];
    expect(rc.values[0][0]).toBe("hello");

    db.close();
  });

  it("is idempotent: re-running when version is already 2 short-circuits", async () => {
    const first = await migrateToV2(dir, WASM);
    expect(first.ok).toBe(true);

    const second = await migrateToV2(dir, WASM);
    expect(second).toEqual({ ok: true, skipped: true });
  });

  it("leaves learner_profile empty (0 rows) when progress.json has no learner_profile", async () => {
    writeFileSync(progressPath, JSON.stringify({ resume_context: null }));

    const res = await migrateToV2(dir, WASM);
    expect(res.ok).toBe(true);

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    expect(
      Number(db.exec("SELECT COUNT(*) FROM learner_profile")[0].values[0][0]),
    ).toBe(0);
    const rc = db.exec(
      "SELECT value FROM app_state WHERE key='resume_context'",
    )[0];
    expect(rc.values[0][0]).toBeNull();
    db.close();
  });

  it("leaves learner_profile empty when last_updated is missing (intake never completed)", async () => {
    writeFileSync(
      progressPath,
      JSON.stringify({
        resume_context: "x",
        learner_profile: {
          experience: "draft",
        },
      }),
    );

    const res = await migrateToV2(dir, WASM);
    expect(res.ok).toBe(true);

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    expect(
      Number(db.exec("SELECT COUNT(*) FROM learner_profile")[0].values[0][0]),
    ).toBe(0);
    db.close();
  });

  it("returns error when progress.json has invalid JSON but still applies schema (user_version stays 1, progress.json preserved for retry)", async () => {
    writeFileSync(progressPath, "{ not json");
    const res = await migrateToV2(dir, WASM);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_progress_json");
    expect(existsSync(progressPath)).toBe(true);

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    // Schema is applied so dashboards/queries don't crash against v2 tables.
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('learner_profile','app_state')",
    )[0];
    expect(tables.values.map((r) => r[0]).sort()).toEqual([
      "app_state",
      "learner_profile",
    ]);
    // user_version remains 1 so the next activation retries the migration.
    expect(Number(db.exec("PRAGMA user_version")[0].values[0][0])).toBe(1);
    db.close();
  });

  it("retries successfully after a failed run once progress.json is fixed", async () => {
    writeFileSync(progressPath, "{ not json");
    const first = await migrateToV2(dir, WASM);
    expect(first.ok).toBe(false);

    writeFileSync(
      progressPath,
      JSON.stringify({
        resume_context: "restored",
        learner_profile: {
          last_updated: "2026-04-20T00:00:00.000Z",
          experience: "x",
        },
      }),
    );
    const second = await migrateToV2(dir, WASM);
    expect(second.ok).toBe(true);

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    expect(Number(db.exec("PRAGMA user_version")[0].values[0][0])).toBe(2);
    expect(
      Number(db.exec("SELECT COUNT(*) FROM learner_profile")[0].values[0][0]),
    ).toBe(1);
    expect(
      db.exec("SELECT value FROM app_state WHERE key='resume_context'")[0]
        .values[0][0],
    ).toBe("restored");
    db.close();
  });
});

describe("cleanupOrphanProgressJson", () => {
  let dir: string;
  let dbPath: string;
  let progressPath: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "v2orphan-"));
    dbPath = join(dir, "data.db");
    progressPath = join(dir, "progress.json");
    await bootstrapDb(dbPath, { wasmPath: WASM, topics: [] });
  });

  it("backs up and removes orphan progress.json when DB is at v2", async () => {
    writeFileSync(progressPath, JSON.stringify({ resume_context: "x" }));

    const res = await cleanupOrphanProgressJson(dir, WASM);
    expect(res).toEqual({ ok: true, cleaned: true });

    expect(existsSync(progressPath)).toBe(false);
    expect(existsSync(`${progressPath}.bak`)).toBe(true);
  });

  it("is a no-op when progress.json does not exist", async () => {
    const res = await cleanupOrphanProgressJson(dir, WASM);
    expect(res).toEqual({ ok: true, cleaned: false });
  });

  it("does not clean up when DB is below v2 (real migration needed)", async () => {
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(dbPath));
    db.exec("PRAGMA user_version = 1");
    writeFileSync(dbPath, Buffer.from(db.export()));
    db.close();

    writeFileSync(progressPath, JSON.stringify({ resume_context: "x" }));

    const res = await cleanupOrphanProgressJson(dir, WASM);
    expect(res).toEqual({ ok: true, cleaned: false });
    expect(existsSync(progressPath)).toBe(true);
  });

  it("is a no-op when DB does not exist", async () => {
    const { rmSync } = await import("node:fs");
    rmSync(dbPath);
    writeFileSync(progressPath, JSON.stringify({ resume_context: "x" }));

    const res = await cleanupOrphanProgressJson(dir, WASM);
    expect(res).toEqual({ ok: true, cleaned: false });
    expect(existsSync(progressPath)).toBe(true);
  });

  it("overwrites an existing .bak when re-running (idempotent)", async () => {
    writeFileSync(`${progressPath}.bak`, "old-bak");
    writeFileSync(progressPath, "new-content");

    const res = await cleanupOrphanProgressJson(dir, WASM);
    expect(res).toEqual({ ok: true, cleaned: true });
    expect(readFileSync(`${progressPath}.bak`, "utf-8")).toBe("new-content");
    expect(existsSync(progressPath)).toBe(false);
  });
});
