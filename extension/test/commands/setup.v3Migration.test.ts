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
import { ensureExternalDb } from "../../src/commands/setup";
import { loadSqlJs } from "../../src/db/sqlJsLoader";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

describe("setup: ensureExternalDb (v3 migration + bootstrap integration)", () => {
  let work: string;
  let mentorDir: string;
  let configPath: string;
  let legacyDb: string;
  let fakeHome: string;
  let originalHome: string | undefined;
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), "setup-v3-"));
    mentorDir = join(work, ".mentor");
    mkdirSync(mentorDir);
    configPath = join(mentorDir, "config.json");
    legacyDb = join(mentorDir, "data.db");
    fakeHome = mkdtempSync(join(tmpdir(), "setup-v3-home-"));
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

  function writeConfig(extra: Record<string, unknown> = {}): void {
    writeFileSync(
      configPath,
      JSON.stringify({ workspacePath: work, locale: "ja", ...extra }, null, 2),
    );
  }

  async function seedLegacyDbWithRow(): Promise<void> {
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database();
    db.exec("PRAGMA user_version = 2");
    db.exec("CREATE TABLE topics (id INTEGER PRIMARY KEY, label TEXT)");
    db.exec("INSERT INTO topics(label) VALUES ('legacy-row')");
    writeFileSync(legacyDb, Buffer.from(db.export()));
    db.close();
  }

  it("migrates legacy DB to external location and renames legacy file", async () => {
    writeConfig();
    await seedLegacyDbWithRow();

    const result = await ensureExternalDb({
      workspaceRoot: work,
      configPath,
      wasmPath: WASM,
    });

    expect(result.migratedFromLegacy).toBe(true);
    expect(result.bootstrapped).toBe(false);

    const today = new Date().toISOString().slice(0, 10);
    expect(existsSync(legacyDb)).toBe(false);
    expect(existsSync(`${legacyDb}.migrated-${today}`)).toBe(true);

    // External DB exists and contains the migrated row.
    expect(existsSync(result.dbPath)).toBe(true);
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(result.dbPath));
    const labels = db.exec("SELECT label FROM topics")[0].values.flat();
    expect(labels).toContain("legacy-row");
    db.close();
  });

  it("bootstraps a fresh external DB when no legacy DB exists", async () => {
    writeConfig();

    const result = await ensureExternalDb({
      workspaceRoot: work,
      configPath,
      wasmPath: WASM,
    });

    expect(result.migratedFromLegacy).toBe(false);
    expect(result.bootstrapped).toBe(true);
    expect(existsSync(result.dbPath)).toBe(true);

    // Bootstrap should seed the default topics so the dashboard has something to render.
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(result.dbPath));
    const rows = db.exec("SELECT label FROM topics")[0]?.values.flat() ?? [];
    expect(rows.length).toBeGreaterThan(0);
    db.close();
  });

  it("persists workspaceId into config.json so future activations are 'ok'", async () => {
    writeConfig();
    await seedLegacyDbWithRow();

    const result = await ensureExternalDb({
      workspaceRoot: work,
      configPath,
      wasmPath: WASM,
    });

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(typeof config.workspaceId).toBe("string");
    expect(config.workspaceId).toBe(result.workspaceId);
  });

  it("preserves an already-existing external DB (idempotent re-run)", async () => {
    writeConfig({ workspaceId: "prebaked-uuid" });
    await seedLegacyDbWithRow();
    const externalDir = join(
      fakeHome,
      "Library",
      "Application Support",
      "MentorStudioCode",
      "prebaked-uuid",
    );
    mkdirSync(externalDir, { recursive: true });
    const externalDbPath = join(externalDir, "data.db");
    writeFileSync(externalDbPath, Buffer.from("preserved external bytes"));

    const result = await ensureExternalDb({
      workspaceRoot: work,
      configPath,
      wasmPath: WASM,
    });

    expect(result.workspaceId).toBe("prebaked-uuid");
    expect(result.bootstrapped).toBe(false);
    expect(readFileSync(externalDbPath).toString()).toBe(
      "preserved external bytes",
    );
    // Legacy DB still gets renamed even if external is preserved (cleanup phase).
    expect(existsSync(legacyDb)).toBe(false);
  });

  it("is a no-op for legacy when called twice with no DB the second time", async () => {
    writeConfig();
    await seedLegacyDbWithRow();
    const first = await ensureExternalDb({
      workspaceRoot: work,
      configPath,
      wasmPath: WASM,
    });
    const second = await ensureExternalDb({
      workspaceRoot: work,
      configPath,
      wasmPath: WASM,
    });
    expect(second.workspaceId).toBe(first.workspaceId);
    expect(second.migratedFromLegacy).toBe(false);
    expect(second.bootstrapped).toBe(false);
  });
});
