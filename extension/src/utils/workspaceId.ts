import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { atomicWriteFile } from "../db/atomicWrite";

export class WorkspaceIdConfigMissingError extends Error {
  constructor(configPath: string) {
    super(`Cannot ensure workspaceId: config.json not found at ${configPath}`);
    this.name = "WorkspaceIdConfigMissingError";
  }
}

const SENTINEL_SUFFIX = ".wsid-gen.lock";
const POLL_INTERVAL_MS = 50;
const POLL_TIMEOUT_MS = 5000;
const VALID_WORKSPACE_ID = /^[a-z0-9-]{1,128}$/;

async function readConfig(
  configPath: string,
): Promise<Record<string, unknown>> {
  const text = await readFile(configPath, "utf-8");
  return JSON.parse(text) as Record<string, unknown>;
}

function readWorkspaceId(obj: Record<string, unknown>): string | null {
  const existing = obj.workspaceId;
  return typeof existing === "string" && existing.length > 0 ? existing : null;
}

export function isValidWorkspaceId(id: string): boolean {
  return VALID_WORKSPACE_ID.test(id);
}

/**
 * Sanitize a repository name for filesystem use as a path-component prefix.
 *
 * Lowercases, replaces runs of non-`[a-z0-9]` (which includes Japanese,
 * spaces, slashes, etc.) with a single `-`, trims leading/trailing dashes,
 * and caps at 64 chars. Returns "" when nothing usable remains (e.g. an
 * all-Japanese name) — callers fall back to UUID-only.
 */
export function sanitizeRepoNameForPath(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

function readRepositoryName(obj: Record<string, unknown>): string {
  const value = obj.repositoryName;
  return typeof value === "string" ? value : "";
}

function newWorkspaceId(repositoryName: string): string {
  const prefix = sanitizeRepoNameForPath(repositoryName);
  const uuid = randomUUID();
  return prefix.length > 0 ? `${prefix}-${uuid}` : uuid;
}

async function writeWorkspaceId(
  configPath: string,
  current: Record<string, unknown>,
  id: string,
): Promise<void> {
  current.workspaceId = id;
  await atomicWriteFile(
    configPath,
    Buffer.from(JSON.stringify(current, null, 2) + "\n", "utf-8"),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function ensureWorkspaceId(configPath: string): Promise<string> {
  if (!existsSync(configPath)) {
    throw new WorkspaceIdConfigMissingError(configPath);
  }
  const initial = await readConfig(configPath);
  const existing = readWorkspaceId(initial);
  if (existing !== null && isValidWorkspaceId(existing)) {
    return existing;
  }

  // Two VSCode windows on the same workspace can both reach this point with
  // no workspaceId persisted yet. Use a mkdir-based sentinel so only one
  // window generates and writes. Losers poll until the winner publishes.
  const sentinel = configPath + SENTINEL_SUFFIX;
  let weAreWinner = false;
  try {
    await mkdir(sentinel);
    weAreWinner = true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }

  if (weAreWinner) {
    try {
      // Re-read inside the critical section in case a previous winner finished
      // between our initial read and our sentinel acquisition.
      const fresh = await readConfig(configPath);
      const already = readWorkspaceId(fresh);
      if (already !== null && isValidWorkspaceId(already)) return already;
      const newId = newWorkspaceId(readRepositoryName(fresh));
      await writeWorkspaceId(configPath, fresh, newId);
      return newId;
    } finally {
      await rm(sentinel, { recursive: true, force: true });
    }
  }

  // Loser path: poll for the winner to publish, then return their id.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const fresh = await readConfig(configPath);
    const persisted = readWorkspaceId(fresh);
    if (persisted !== null && isValidWorkspaceId(persisted)) return persisted;
    if (!existsSync(sentinel)) break; // winner gave up without publishing
  }

  // Winner never published (crashed mid-flight, stale sentinel from a prior
  // process, etc.). Take over: clear the sentinel and recurse once.
  await rm(sentinel, { recursive: true, force: true });
  return ensureWorkspaceId(configPath);
}
