import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSqlJs, withWriteTransaction } from "../../src/db";
import { FileWatcherService } from "../../src/services/fileWatcher";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — test mock
import { __resetWatchers, __watchers } from "../__mocks__/vscode";
import { makeEnvWithDb, WASM } from "../cli/helpers";

async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe("FileWatcherService: data.db watcher", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fw-"));
    __resetWatchers();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("watches data.db with debounce and notifies subscriber once for multiple rapid changes", async () => {
    let calls = 0;
    const svc = new FileWatcherService(
      dir,
      ".mentor",
      () => {},
      undefined,
      undefined,
      undefined,
      () => {
        calls += 1;
      },
    );
    await svc.start();

    const dbWatcher = __watchers.find((w) =>
      w.pattern.pattern.endsWith("data.db"),
    );
    expect(dbWatcher).toBeDefined();

    dbWatcher!.emitChange();
    dbWatcher!.emitChange();
    dbWatcher!.emitChange();

    await wait(400);
    expect(calls).toBe(1);

    svc.dispose();
  });

  it("does not watch question-history.json", async () => {
    const svc = new FileWatcherService(dir, ".mentor", () => {});
    await svc.start();

    const patterns = __watchers.map((w) => w.pattern.pattern);
    expect(patterns.some((p) => p.includes("question-history"))).toBe(false);

    svc.dispose();
  });
});

// Helper to open a read-only DB for assertions
async function openDb(dbPath: string): Promise<import("sql.js").Database> {
  const SQL = await loadSqlJs(WASM);
  return new SQL.Database(readFileSync(dbPath));
}

describe("FileWatcherService: pauseActivePlan / changeActivePlanFile / createAndActivatePlan", () => {
  let env: Awaited<ReturnType<typeof makeEnvWithDb>>;
  let svc: FileWatcherService;

  beforeEach(async () => {
    __resetWatchers();
    env = await makeEnvWithDb([]);
    svc = new FileWatcherService(
      env.dir,
      ".mentor",
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      env.paths.dbPath,
      WASM,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(env.dir, { recursive: true, force: true });
  });

  it("pauseActivePlan sets plan status to paused", async () => {
    // Seed an active plan directly
    await withWriteTransaction(
      env.paths.dbPath,
      { wasmPath: WASM, purpose: "normal" },
      (db: Database) => {
        db.exec(
          "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES ('p1', 'p1.md', 'active', 1, '2026-01-01T00:00:00Z')",
        );
        return undefined;
      },
    );
    const idRes = await (async () => {
      const db = await openDb(env.paths.dbPath);
      try {
        return Number(
          db.exec("SELECT id FROM plans WHERE name='p1'")[0].values[0][0],
        );
      } finally {
        db.close();
      }
    })();

    await svc.pauseActivePlan(idRes);

    const db = await openDb(env.paths.dbPath);
    try {
      const rows = db.exec("SELECT status FROM plans WHERE id = ?", [idRes]);
      expect(rows[0].values[0][0]).toBe("paused");
    } finally {
      db.close();
    }
  });

  it("pauseActivePlan throws when db not ready", async () => {
    const noDbSvc = new FileWatcherService(env.dir, ".mentor", () => {});
    await expect(noDbSvc.pauseActivePlan(1)).rejects.toThrow("db_not_ready");
  });

  it("changeActivePlanFile updates filePath on the plan", async () => {
    await withWriteTransaction(
      env.paths.dbPath,
      { wasmPath: WASM, purpose: "normal" },
      (db: Database) => {
        db.exec(
          "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES ('p2', 'old.md', 'queued', 1, '2026-01-01T00:00:00Z')",
        );
        return undefined;
      },
    );
    const id = await (async () => {
      const db = await openDb(env.paths.dbPath);
      try {
        return Number(
          db.exec("SELECT id FROM plans WHERE name='p2'")[0].values[0][0],
        );
      } finally {
        db.close();
      }
    })();

    await svc.changeActivePlanFile(id, "new-path.md");

    const db = await openDb(env.paths.dbPath);
    try {
      const rows = db.exec("SELECT filePath FROM plans WHERE id = ?", [id]);
      expect(rows[0].values[0][0]).toBe("new-path.md");
    } finally {
      db.close();
    }
  });

  it("changeActivePlanFile throws when db not ready", async () => {
    const noDbSvc = new FileWatcherService(env.dir, ".mentor", () => {});
    await expect(noDbSvc.changeActivePlanFile(1, "x.md")).rejects.toThrow(
      "db_not_ready",
    );
  });

  it("createAndActivatePlan creates plan with active status and correct name/filePath", async () => {
    await svc.createAndActivatePlan("plans/chapter1.md");

    const db = await openDb(env.paths.dbPath);
    try {
      const rows = db.exec(
        "SELECT name, filePath, status FROM plans WHERE filePath = 'plans/chapter1.md'",
      );
      expect(rows[0].values).toHaveLength(1);
      const [name, filePath, status] = rows[0].values[0];
      expect(name).toBe("chapter1");
      expect(filePath).toBe("plans/chapter1.md");
      // Plan is immediately activated (0-task active plans now allowed)
      expect(status).toBe("active");
    } finally {
      db.close();
    }
  });

  it("createAndActivatePlan calling twice: second plan is active, first is demoted to queued", async () => {
    await svc.createAndActivatePlan("plans/first.md");
    await svc.createAndActivatePlan("plans/second.md");

    const db = await openDb(env.paths.dbPath);
    try {
      const rows = db.exec("SELECT COUNT(*) FROM plans");
      expect(Number(rows[0].values[0][0])).toBe(2);
      // activatePlan demotes the previous active plan to queued
      const statusRows = db.exec("SELECT status FROM plans ORDER BY id");
      const statuses = statusRows[0].values.map(([s]) => s);
      expect(statuses).toEqual(["queued", "active"]);
    } finally {
      db.close();
    }
  });

  it("createAndActivatePlan throws when db not ready", async () => {
    const noDbSvc = new FileWatcherService(env.dir, ".mentor", () => {});
    await expect(noDbSvc.createAndActivatePlan("x.md")).rejects.toThrow(
      "db_not_ready",
    );
  });

  it("write methods invoke onDbChanged so Plan Panel stays in sync", async () => {
    await withWriteTransaction(
      env.paths.dbPath,
      { wasmPath: WASM, purpose: "normal" },
      (db: Database) => {
        db.exec(
          "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES ('p3', 'old.md', 'queued', 1, '2026-01-01T00:00:00Z')",
        );
        return undefined;
      },
    );
    const id = await (async () => {
      const db = await openDb(env.paths.dbPath);
      try {
        return Number(
          db.exec("SELECT id FROM plans WHERE name='p3'")[0].values[0][0],
        );
      } finally {
        db.close();
      }
    })();

    const onDbChanged = vi.fn();
    const svcWithHook = new FileWatcherService(
      env.dir,
      ".mentor",
      () => {},
      undefined,
      undefined,
      undefined,
      onDbChanged,
      env.paths.dbPath,
      WASM,
    );

    await svcWithHook.changeActivePlanFile(id, "new-path.md");
    expect(onDbChanged).toHaveBeenCalledTimes(1);
  });
});
