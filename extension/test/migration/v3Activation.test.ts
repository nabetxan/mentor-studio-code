import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSqlJs } from "../../src/db/sqlJsLoader";
import { runMigrationsForActivation } from "../../src/migration/runAll";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

describe("migration activation chain — v3 detection only", () => {
  let work: string;
  let mentorDir: string;
  let legacyDb: string;
  let fakeHome: string;
  let originalPlatform: PropertyDescriptor | undefined;
  let originalHome: string | undefined;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), "v3-act-"));
    mentorDir = join(work, ".mentor");
    mkdirSync(mentorDir);
    legacyDb = join(mentorDir, "data.db");
    fakeHome = mkdtempSync(join(tmpdir(), "v3-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
  });

  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
    rmSync(fakeHome, { recursive: true, force: true });
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  async function seed(extraConfig: Record<string, unknown> = {}): Promise<void> {
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database();
    db.exec("PRAGMA user_version = 2");
    db.exec("CREATE TABLE topics(id INTEGER PRIMARY KEY, label TEXT)");
    db.exec("INSERT INTO topics(label) VALUES ('seeded')");
    writeFileSync(legacyDb, Buffer.from(db.export()));
    db.close();
    writeFileSync(
      join(mentorDir, "config.json"),
      JSON.stringify(
        { workspacePath: work, locale: "ja", ...extraConfig },
        null,
        2,
      ),
    );
  }

  it("detects v3 needed when legacy DB present — does NOT execute migration", async () => {
    await seed();
    const result = await runMigrationsForActivation({
      workspaceRoot: work,
      wasmPath: WASM,
    });

    expect(result.status).toBe("needsMigration");
    // v3 must NOT have run: legacy file untouched, no .migrated-* sidecar.
    expect(existsSync(legacyDb)).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    expect(existsSync(`${legacyDb}.migrated-${today}`)).toBe(false);
    // Activation must not have written workspaceId to config.json — Setup owns that.
    const config = JSON.parse(
      readFileSync(join(mentorDir, "config.json"), "utf-8"),
    );
    expect(config.workspaceId).toBeUndefined();
    expect(result.workspaceId).toBeNull();
  });

  it("detects v3 even when enableMentor is false (user must still be prompted to migrate)", async () => {
    await seed({ enableMentor: false });
    const result = await runMigrationsForActivation({
      workspaceRoot: work,
      wasmPath: WASM,
    });
    expect(result.status).toBe("needsMigration");
    expect(existsSync(legacyDb)).toBe(true);
  });

  it("returns status 'noConfig' when config.json absent (Setup never ran)", async () => {
    const result = await runMigrationsForActivation({
      workspaceRoot: work,
      wasmPath: WASM,
    });
    expect(result.status).toBe("noConfig");
    expect(result.workspaceId).toBeNull();
    expect(result.paths.dbPath).toBe(legacyDb);
  });

  it("returns 'ok' with workspaceId when no legacy DB exists (post-migration / fresh setup)", async () => {
    // Seed config.json without a legacy DB (post-Setup steady state).
    writeFileSync(
      join(mentorDir, "config.json"),
      JSON.stringify(
        { workspacePath: work, locale: "ja", workspaceId: "fixed-uuid" },
        null,
        2,
      ),
    );
    const result = await runMigrationsForActivation({
      workspaceRoot: work,
      wasmPath: WASM,
    });
    expect(result.status).toBe("ok");
    expect(result.workspaceId).toBe("fixed-uuid");
    const expectedDb = join(
      fakeHome,
      "Library",
      "Application Support",
      "MentorStudioCode",
      "fixed-uuid",
      "data.db",
    );
    expect(result.paths.dbPath).toBe(expectedDb);
  });
});
