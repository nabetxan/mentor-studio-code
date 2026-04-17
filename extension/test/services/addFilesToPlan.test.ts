import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscodeTypes from "vscode";
import { loadSqlJs } from "../../src/db/index.js";
import { FileWatcherService } from "../../src/services/fileWatcher.js";
import { makeEnvWithDb, WASM } from "../cli/helpers.js";

// Mock vscode module
vi.mock("vscode", () => import("../__mocks__/vscode.js"));

// We need to spy on specific mock functions
import * as vscodeMock from "../__mocks__/vscode.js";

interface MockUriLocal {
  fsPath: string;
  toString(): string;
}

function makeUri(fsPath: string): vscodeTypes.Uri {
  return { fsPath, toString: () => fsPath } as unknown as vscodeTypes.Uri;
}

// Helper to open read-only DB for assertions
async function openReadOnly(
  dbPath: string,
): Promise<import("sql.js").Database> {
  const SQL = await loadSqlJs(WASM);
  return new SQL.Database(readFileSync(dbPath));
}

describe("FileWatcherService.addFilesToPlan", () => {
  let env: Awaited<ReturnType<typeof makeEnvWithDb>>;
  let svc: FileWatcherService;

  beforeEach(async () => {
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

    // Add asRelativePath to workspace mock
    (
      vscodeMock.workspace as unknown as {
        asRelativePath: (
          uri: MockUriLocal,
          includeWorkspace: boolean,
        ) => string;
      }
    ).asRelativePath = (
      uri: MockUriLocal,
      _includeWorkspace: boolean,
    ): string => {
      // Simulate relative path from workspace root
      const rel = uri.fsPath.startsWith(env.dir + "/")
        ? uri.fsPath.slice(env.dir.length + 1)
        : uri.fsPath;
      return rel;
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("single .md file creates 1 plan with correct name and filePath", async () => {
    const infoSpy = vi
      .spyOn(vscodeMock.window, "showInformationMessage")
      .mockResolvedValue(undefined);

    const filePath = join(env.dir, "my-plan.md");
    await svc.addFilesToPlan([makeUri(filePath)]);

    const db = await openReadOnly(env.paths.dbPath);
    try {
      const res = db.exec("SELECT name, filePath, status FROM plans");
      expect(res[0]?.values).toHaveLength(1);
      const [name, fp, status] = res[0].values[0];
      expect(name).toBe("my-plan");
      expect(fp).toBe("my-plan.md");
      expect(status).toBe("backlog");
    } finally {
      db.close();
    }

    expect(infoSpy).toHaveBeenCalledOnce();
    const callArgs = infoSpy.mock.calls[0];
    // First arg is message, second+ are button labels
    expect(callArgs[0]).toContain("1");
    expect(callArgs[1]).toBe("Open Plan Panel");
  });

  it("multiple .md files creates N plans", async () => {
    vi.spyOn(vscodeMock.window, "showInformationMessage").mockResolvedValue(
      undefined,
    );

    const uris = [
      makeUri(join(env.dir, "plan-a.md")),
      makeUri(join(env.dir, "plan-b.md")),
      makeUri(join(env.dir, "plan-c.md")),
    ];
    await svc.addFilesToPlan(uris);

    const db = await openReadOnly(env.paths.dbPath);
    try {
      const res = db.exec("SELECT COUNT(*) FROM plans");
      expect(Number(res[0].values[0][0])).toBe(3);
    } finally {
      db.close();
    }
  });

  it("duplicate filePath is skipped (plan already exists)", async () => {
    vi.spyOn(vscodeMock.window, "showInformationMessage").mockResolvedValue(
      undefined,
    );
    const warnSpy = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue(undefined);

    // First insertion
    await svc.addFilesToPlan([makeUri(join(env.dir, "dup.md"))]);

    // Reset spies
    vi.clearAllMocks();
    const infoSpy2 = vi
      .spyOn(vscodeMock.window, "showInformationMessage")
      .mockResolvedValue(undefined);
    const warnSpy2 = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue(undefined);

    // Second insertion — same file, should be skipped
    await svc.addFilesToPlan([makeUri(join(env.dir, "dup.md"))]);

    // All skipped → warning, no info
    expect(warnSpy2).toHaveBeenCalledOnce();
    expect(infoSpy2).not.toHaveBeenCalled();

    // Still only 1 row in DB
    const db = await openReadOnly(env.paths.dbPath);
    try {
      const res = db.exec("SELECT COUNT(*) FROM plans");
      expect(Number(res[0].values[0][0])).toBe(1);
    } finally {
      db.close();
    }

    // Suppress unused variable warning
    void warnSpy;
  });

  it("mixed added and skipped shows info message with both counts", async () => {
    vi.spyOn(vscodeMock.window, "showInformationMessage").mockResolvedValue(
      undefined,
    );

    // Pre-create one plan
    await svc.addFilesToPlan([makeUri(join(env.dir, "existing.md"))]);

    vi.clearAllMocks();
    const infoSpy = vi
      .spyOn(vscodeMock.window, "showInformationMessage")
      .mockResolvedValue(undefined);

    await svc.addFilesToPlan([
      makeUri(join(env.dir, "existing.md")), // skip
      makeUri(join(env.dir, "new-file.md")), // add
    ]);

    expect(infoSpy).toHaveBeenCalledOnce();
    const msg = infoSpy.mock.calls[0][0] as string;
    // Message should mention both added and skipped counts
    expect(msg).toContain("1");
  });

  it("all duplicates shows warning message without info", async () => {
    const infoSpy = vi
      .spyOn(vscodeMock.window, "showInformationMessage")
      .mockResolvedValue(undefined);
    vi.spyOn(vscodeMock.window, "showWarningMessage").mockResolvedValue(
      undefined,
    );

    // Pre-create two plans
    await svc.addFilesToPlan([
      makeUri(join(env.dir, "alpha.md")),
      makeUri(join(env.dir, "beta.md")),
    ]);

    vi.clearAllMocks();
    const infoSpy2 = vi
      .spyOn(vscodeMock.window, "showInformationMessage")
      .mockResolvedValue(undefined);
    const warnSpy2 = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue(undefined);

    await svc.addFilesToPlan([
      makeUri(join(env.dir, "alpha.md")),
      makeUri(join(env.dir, "beta.md")),
    ]);

    expect(warnSpy2).toHaveBeenCalledOnce();
    expect(infoSpy2).not.toHaveBeenCalled();

    void infoSpy;
  });

  it("non-.md files are skipped defensively and do nothing", async () => {
    const infoSpy = vi
      .spyOn(vscodeMock.window, "showInformationMessage")
      .mockResolvedValue(undefined);
    const warnSpy = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue(undefined);

    await svc.addFilesToPlan([
      makeUri(join(env.dir, "image.png")),
      makeUri(join(env.dir, "script.ts")),
    ]);

    // No message, no DB rows
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    const db = await openReadOnly(env.paths.dbPath);
    try {
      const res = db.exec("SELECT COUNT(*) FROM plans");
      expect(Number(res[0].values[0][0])).toBe(0);
    } finally {
      db.close();
    }
  });

  it('"Open Plan Panel" action triggers executeCommand with correct id', async () => {
    const execSpy = vi
      .spyOn(vscodeMock.commands, "executeCommand")
      .mockResolvedValue(undefined);

    // Simulate user clicking "Open Plan Panel"
    vi.spyOn(vscodeMock.window, "showInformationMessage").mockImplementation(
      async (...args: unknown[]): Promise<string | undefined> => {
        // Return the button label to simulate a click
        const button = args[1];
        return typeof button === "string" ? button : undefined;
      },
    );

    await svc.addFilesToPlan([makeUri(join(env.dir, "click-test.md"))]);

    expect(execSpy).toHaveBeenCalledWith("mentor-studio.openPlanPanel");
  });

  it("empty input array does nothing", async () => {
    const infoSpy = vi
      .spyOn(vscodeMock.window, "showInformationMessage")
      .mockResolvedValue(undefined);
    const warnSpy = vi
      .spyOn(vscodeMock.window, "showWarningMessage")
      .mockResolvedValue(undefined);

    await svc.addFilesToPlan([]);

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("NULL filePath plans do not block adding a new plan with a file path", async () => {
    vi.spyOn(vscodeMock.window, "showInformationMessage").mockResolvedValue(
      undefined,
    );

    // Seed a plan with NULL filePath directly via planWrites-style insert
    const { withWriteTransaction } = await import("../../src/db/index.js");
    await withWriteTransaction(
      env.paths.dbPath,
      { wasmPath: WASM, purpose: "normal" },
      (db: import("sql.js").Database) => {
        db.exec(
          "INSERT INTO plans (name, filePath, status, sortOrder, createdAt) VALUES ('UI-only plan', NULL, 'queued', 1, '2026-01-01T00:00:00Z')",
        );
        return undefined;
      },
    );

    // Now add a file-backed plan — should NOT be blocked by the NULL plan
    await svc.addFilesToPlan([makeUri(join(env.dir, "real-plan.md"))]);

    const db = await openReadOnly(env.paths.dbPath);
    try {
      const res = db.exec("SELECT COUNT(*) FROM plans");
      expect(Number(res[0].values[0][0])).toBe(2);
    } finally {
      db.close();
    }
  });
});
