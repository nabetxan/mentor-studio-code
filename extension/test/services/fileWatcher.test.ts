import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileWatcherService } from "../../src/services/fileWatcher";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — test mock
import { __resetWatchers, __watchers } from "../__mocks__/vscode";

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
