import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { acquireLock, LockTimeoutError, releaseLock } from "../../src/db/lock";

describe("file lock — basic", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lock-"));
  });

  it("creates lock directory with metadata", async () => {
    const handle = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
    });
    const lockDir = join(dir, "data.db.lock");
    expect(existsSync(lockDir)).toBe(true);
    const meta = JSON.parse(readFileSync(join(lockDir, "owner.json"), "utf-8"));
    expect(meta.pid).toBe(process.pid);
    expect(meta.purpose).toBe("normal");
    expect(typeof meta.acquiredAt).toBe("string");
    await releaseLock(handle);
  });

  it("releases lock (removes directory)", async () => {
    const handle = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
    });
    await releaseLock(handle);
    expect(existsSync(join(dir, "data.db.lock"))).toBe(false);
  });

  it("fails with LockTimeoutError when held", async () => {
    const first = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
    });
    await expect(
      acquireLock(join(dir, "data.db"), { purpose: "normal", timeoutMs: 200 }),
    ).rejects.toBeInstanceOf(LockTimeoutError);
    await releaseLock(first);
  });

  it("allows acquisition after release", async () => {
    const first = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
    });
    await releaseLock(first);
    const second = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
    });
    await releaseLock(second);
  });
});

describe("file lock — stale detection", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lock-stale-"));
  });

  it("reclaims stale normal lock older than 5s", async () => {
    const lockDir = join(dir, "data.db.lock");
    await mkdir(lockDir);
    await writeFile(
      join(lockDir, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        acquiredAt: new Date(Date.now() - 6000).toISOString(),
        purpose: "normal",
      }),
    );
    const handle = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
      timeoutMs: 500,
    });
    await releaseLock(handle);
  });

  it("does NOT reclaim normal lock 4s old", async () => {
    const lockDir = join(dir, "data.db.lock");
    await mkdir(lockDir);
    await writeFile(
      join(lockDir, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        acquiredAt: new Date(Date.now() - 4000).toISOString(),
        purpose: "normal",
      }),
    );
    await expect(
      acquireLock(join(dir, "data.db"), { purpose: "normal", timeoutMs: 300 }),
    ).rejects.toBeInstanceOf(LockTimeoutError);
  });

  it("does NOT reclaim 30s-old migration lock", async () => {
    const lockDir = join(dir, "data.db.lock");
    await mkdir(lockDir);
    await writeFile(
      join(lockDir, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        acquiredAt: new Date(Date.now() - 30_000).toISOString(),
        purpose: "migration",
      }),
    );
    await expect(
      acquireLock(join(dir, "data.db"), { purpose: "normal", timeoutMs: 300 }),
    ).rejects.toBeInstanceOf(LockTimeoutError);
  });

  it("reclaims 61s-old migration lock", async () => {
    const lockDir = join(dir, "data.db.lock");
    await mkdir(lockDir);
    await writeFile(
      join(lockDir, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        acquiredAt: new Date(Date.now() - 61_000).toISOString(),
        purpose: "migration",
      }),
    );
    const handle = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
      timeoutMs: 500,
    });
    await releaseLock(handle);
  });

  it("reclaims lock with invalid acquiredAt timestamp", async () => {
    const lockDir = join(dir, "data.db.lock");
    await mkdir(lockDir);
    await writeFile(
      join(lockDir, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        acquiredAt: "not-a-valid-date",
        purpose: "normal",
      }),
    );
    const handle = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
      timeoutMs: 300,
    });
    await releaseLock(handle);
  });

  it("reclaims lock immediately if pid is dead", async () => {
    const lockDir = join(dir, "data.db.lock");
    await mkdir(lockDir);
    await writeFile(
      join(lockDir, "owner.json"),
      JSON.stringify({
        pid: 999_999_999,
        acquiredAt: new Date().toISOString(),
        purpose: "normal",
      }),
    );
    const handle = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
      timeoutMs: 300,
    });
    await releaseLock(handle);
  });
});

describe("file lock — heartbeat", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lock-hb-"));
  });

  it("refreshes acquiredAt while held", async () => {
    const handle = await acquireLock(join(dir, "data.db"), {
      purpose: "normal",
      heartbeatMs: 100,
    });
    const firstMeta = JSON.parse(
      readFileSync(join(handle.lockDir, "owner.json"), "utf-8"),
    );
    await new Promise((r) => setTimeout(r, 250));
    const laterMeta = JSON.parse(
      readFileSync(join(handle.lockDir, "owner.json"), "utf-8"),
    );
    expect(new Date(laterMeta.acquiredAt).getTime()).toBeGreaterThan(
      new Date(firstMeta.acquiredAt).getTime(),
    );
    await releaseLock(handle);
  });

  it("does not grow SIGINT listener count on repeated acquires", async () => {
    const h1 = await acquireLock(join(tmpdir(), `lock-si-${Date.now()}-1`), {
      purpose: "normal",
    });
    const afterFirst = process.listenerCount("SIGINT");
    const h2 = await acquireLock(join(tmpdir(), `lock-si-${Date.now()}-2`), {
      purpose: "normal",
    });
    expect(process.listenerCount("SIGINT")).toBe(afterFirst);
    await releaseLock(h1);
    await releaseLock(h2);
  });
});
