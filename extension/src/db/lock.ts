import { rmSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteFile } from "./atomicWrite";

export type LockPurpose = "normal" | "migration";

export interface LockOptions {
  purpose: LockPurpose;
  timeoutMs?: number;
  retryIntervalMs?: number;
  heartbeatMs?: number;
}

export interface LockHandle {
  lockDir: string;
  dbPath: string;
  purpose: LockPurpose;
  heartbeatTimer?: NodeJS.Timeout;
  pendingHeartbeat?: Promise<void>;
}

export class LockTimeoutError extends Error {
  constructor(dbPath: string) {
    super(`Failed to acquire lock for ${dbPath} within timeout`);
    this.name = "LockTimeoutError";
  }
}

const STALE_MS: Record<LockPurpose, number> = {
  normal: 5000,
  migration: 60_000,
};

const activeHandles = new Set<LockHandle>();
let cleanupRegistered = false;

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const cleanup = () => {
    for (const h of activeHandles) {
      try {
        if (h.heartbeatTimer) clearInterval(h.heartbeatTimer);
        rmSync(h.lockDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") return false;
    // EPERM means process exists but we can't signal it — treat as alive.
    return true;
  }
}

async function isStale(lockDir: string, deadline: number): Promise<boolean> {
  // Tolerate transient gaps where the winning acquirer has created lockDir
  // but hasn't yet written metadata, or a partial read of a mid-write.
  // Keep the retry budget tight so it doesn't eat a short outer timeout.
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const raw = await readFile(join(lockDir, "owner.json"), "utf-8");
      const meta = JSON.parse(raw) as {
        pid: number;
        acquiredAt: string;
        purpose: LockPurpose;
      };
      if (!isPidAlive(meta.pid)) return true;
      const acquiredMs = new Date(meta.acquiredAt).getTime();
      if (Number.isNaN(acquiredMs)) return true;
      const age = Date.now() - acquiredMs;
      const threshold = STALE_MS[meta.purpose] ?? STALE_MS.normal;
      return age > threshold;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || err instanceof SyntaxError) {
        if (attempt === maxAttempts - 1 || Date.now() >= deadline) break;
        await new Promise((r) => setTimeout(r, 10));
        continue;
      }
      return true;
    }
  }
  // Holder never published (or kept publishing) valid metadata — treat as stale.
  return true;
}

export async function acquireLock(
  dbPath: string,
  opts: LockOptions,
): Promise<LockHandle> {
  registerCleanup();
  const lockDir = `${dbPath}.lock`;
  const timeout = opts.timeoutMs ?? 2000;
  const interval = opts.retryIntervalMs ?? 50;
  const heartbeat = opts.heartbeatMs ?? 3000;
  const deadline = Date.now() + timeout;

  const ownerPath = join(lockDir, "owner.json");
  const writeOwner = () =>
    atomicWriteFile(
      ownerPath,
      Buffer.from(
        JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
          purpose: opts.purpose,
        }),
      ),
    );

  while (true) {
    try {
      await mkdir(lockDir);
      await writeOwner();
      const handle: LockHandle = { lockDir, dbPath, purpose: opts.purpose };
      handle.heartbeatTimer = setInterval(() => {
        // Track the in-flight write so releaseLock can wait for the rename
        // to finish before rm'ing the lock dir; otherwise atomicWriteFile's
        // tmp file can reappear mid-rm and trigger ENOTEMPTY.
        handle.pendingHeartbeat = writeOwner().catch(() => {});
      }, heartbeat);
      // Don't let the heartbeat keep the event loop alive.
      handle.heartbeatTimer.unref?.();
      activeHandles.add(handle);
      return handle;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (await isStale(lockDir, deadline)) {
        await rm(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new LockTimeoutError(dbPath);
      await sleep(interval);
    }
  }
}

export async function releaseLock(handle: LockHandle): Promise<void> {
  if (handle.heartbeatTimer) clearInterval(handle.heartbeatTimer);
  activeHandles.delete(handle);
  // Wait for any heartbeat write still in flight so its rename finishes
  // before we try to rmdir the lock directory.
  if (handle.pendingHeartbeat) {
    await handle.pendingHeartbeat;
  }
  // Short retry for residual FS-level races (e.g. concurrent acquirers
  // reading metadata). ENOTEMPTY clears as soon as those operations settle.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await rm(handle.lockDir, { recursive: true, force: true });
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOTEMPTY") throw err;
      await sleep(20);
    }
  }
  await rm(handle.lockDir, { recursive: true, force: true });
}
