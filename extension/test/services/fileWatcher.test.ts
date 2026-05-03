import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { Database } from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSqlJs, withWriteTransaction } from "../../src/db";
import { FileWatcherService } from "../../src/services/fileWatcher";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — test mock
import { __resetWatchers, __watchers } from "../__mocks__/vscode";
import { makeEnvWithDb, seedProfileRow, WASM } from "../cli/helpers";

class MementoStub {
  private store = new Map<string, unknown>();
  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }
  update(key: string, value: unknown): Promise<void> {
    if (value === undefined) this.store.delete(key);
    else this.store.set(key, value);
    return Promise.resolve();
  }
  keys(): readonly string[] {
    return Array.from(this.store.keys());
  }
}

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

  it("watches the resolved dbPath when the DB lives outside the workspace", async () => {
    const externalDbPath = join(tmpdir(), "mentor-external", "workspace-1", "data.db");
    const svc = new FileWatcherService(
      dir,
      ".mentor",
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      externalDbPath,
    );

    await svc.start();

    const dbWatcher = __watchers.find(
      (w) => w.pattern.pattern === basename(externalDbPath),
    );
    expect(dbWatcher).toBeDefined();
    expect(dbWatcher?.pattern.base).toBe(dirname(externalDbPath));

    svc.dispose();
  });

  it("watches project and personal AI entrypoint files", async () => {
    const svc = new FileWatcherService(dir, ".mentor", () => {});

    await svc.start();

    const patterns = __watchers.map((w) => `${w.pattern.base}:${w.pattern.pattern}`);
    expect(patterns.some((pattern) => pattern.endsWith(`${dir}:CLAUDE.md`))).toBe(
      true,
    );
    expect(patterns.some((pattern) => pattern.endsWith(`${dir}:AGENTS.md`))).toBe(
      true,
    );
    expect(
      patterns.some(
        (pattern) =>
          pattern.includes(".claude/projects/") && pattern.endsWith(":CLAUDE.md"),
      ),
    ).toBe(true);

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

  it("changeActivePlanFile activates the plan that matches the selected file, pausing the prior active", async () => {
    // Setup: existing active plan + a queued plan for a different file.
    await withWriteTransaction(
      env.paths.dbPath,
      { wasmPath: WASM, purpose: "normal" },
      (db: Database) => {
        db.exec(
          "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES ('prior-active', 'prior.md', 'active', 1, '2026-01-01T00:00:00Z')",
        );
        db.exec(
          "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES ('queued', 'new-path.md', 'queued', 2, '2026-01-01T00:00:00Z')",
        );
        return undefined;
      },
    );

    await svc.changeActivePlanFile("new-path.md");

    const db = await openDb(env.paths.dbPath);
    try {
      const rows = db.exec(
        "SELECT filePath, status FROM plans ORDER BY id",
      );
      const statuses = Object.fromEntries(
        rows[0].values.map(([fp, s]) => [String(fp), String(s)]),
      );
      // Prior active is now paused; the queued plan for the selected file is active.
      expect(statuses["prior.md"]).toBe("paused");
      expect(statuses["new-path.md"]).toBe("active");
      // No new row was created (reused existing).
      expect(rows[0].values).toHaveLength(2);
    } finally {
      db.close();
    }
  });

  it("changeActivePlanFile throws when db not ready", async () => {
    const noDbSvc = new FileWatcherService(env.dir, ".mentor", () => {});
    await expect(noDbSvc.changeActivePlanFile("x.md")).rejects.toThrow(
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

  it("createAndActivatePlan calling twice: second plan is active, first is demoted to paused", async () => {
    await svc.createAndActivatePlan("plans/first.md");
    await svc.createAndActivatePlan("plans/second.md");

    const db = await openDb(env.paths.dbPath);
    try {
      const rows = db.exec("SELECT COUNT(*) FROM plans");
      expect(Number(rows[0].values[0][0])).toBe(2);
      // Settings-driven activation (setAsActivePlan) demotes prior active to 'paused'.
      const statusRows = db.exec("SELECT status FROM plans ORDER BY id");
      const statuses = statusRows[0].values.map(([s]) => s);
      expect(statuses).toEqual(["paused", "active"]);
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

    await svcWithHook.changeActivePlanFile("new-path.md");
    expect(onDbChanged).toHaveBeenCalledTimes(1);
  });
});

describe("FileWatcherService: learner_profile sync on refresh", () => {
  let env: Awaited<ReturnType<typeof makeEnvWithDb>>;

  beforeEach(async () => {
    __resetWatchers();
    env = await makeEnvWithDb([]);
  });

  afterEach(() => {
    rmSync(env.dir, { recursive: true, force: true });
  });

  it("appends a new learner_profile row when globalState is newer than DB", async () => {
    const state = new MementoStub();
    const newerProfile = {
      experience: "3 years TS",
      level: "intermediate",
      interests: ["react"],
      weak_areas: ["async"],
      mentor_style: "socratic",
      last_updated: "2026-05-01T00:00:00Z",
    };
    await state.update("learnerProfile", newerProfile);
    await seedProfileRow(env.paths.dbPath, {
      experience: "old",
      level: "beginner",
      interests: [],
      weak_areas: [],
      mentor_style: "",
      last_updated: "2026-04-01T00:00:00Z",
    });

    const svc = new FileWatcherService(
      env.dir,
      ".mentor",
      () => {},
      undefined,
      undefined,
      state as unknown as import("vscode").Memento,
      undefined,
      env.paths.dbPath,
      WASM,
    );
    await svc.refresh();

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(env.paths.dbPath));
    try {
      const rows = db.exec(
        "SELECT experience, lastUpdated FROM learner_profile ORDER BY id",
      )[0];
      expect(rows.values).toHaveLength(2);
      expect(rows.values[1]).toEqual(["3 years TS", "2026-05-01T00:00:00Z"]);
    } finally {
      db.close();
    }

    svc.dispose();
  });

  it("updates globalState when DB is newer than globalState", async () => {
    const state = new MementoStub();
    await state.update("learnerProfile", {
      experience: "old",
      level: "beginner",
      interests: [],
      weak_areas: [],
      mentor_style: "",
      last_updated: "2026-04-01T00:00:00Z",
    });
    await seedProfileRow(env.paths.dbPath, {
      experience: "newer",
      level: "advanced",
      interests: ["go"],
      weak_areas: ["types"],
      mentor_style: "direct",
      last_updated: "2026-05-01T00:00:00Z",
    });

    const svc = new FileWatcherService(
      env.dir,
      ".mentor",
      () => {},
      undefined,
      undefined,
      state as unknown as import("vscode").Memento,
      undefined,
      env.paths.dbPath,
      WASM,
    );
    await svc.refresh();

    const updated = state.get<{ experience: string; last_updated: string }>(
      "learnerProfile",
    );
    expect(updated?.experience).toBe("newer");
    expect(updated?.last_updated).toBe("2026-05-01T00:00:00Z");

    svc.dispose();
  });

  it("does nothing when both DB and globalState are empty", async () => {
    const state = new MementoStub();
    const svc = new FileWatcherService(
      env.dir,
      ".mentor",
      () => {},
      undefined,
      undefined,
      state as unknown as import("vscode").Memento,
      undefined,
      env.paths.dbPath,
      WASM,
    );
    await svc.refresh();

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(env.paths.dbPath));
    try {
      const rows = db.exec("SELECT COUNT(*) FROM learner_profile")[0];
      expect(Number(rows.values[0][0])).toBe(0);
    } finally {
      db.close();
    }
    expect(state.get("learnerProfile")).toBeUndefined();

    svc.dispose();
  });
});
