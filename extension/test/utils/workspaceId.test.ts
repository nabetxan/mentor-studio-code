import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureWorkspaceId,
  isValidWorkspaceId,
  sanitizeRepoNameForPath,
  WorkspaceIdConfigMissingError,
} from "../../src/utils/workspaceId";

// Format: optional `<sanitized-prefix>-` followed by a UUID. The prefix can
// itself contain `-` (e.g. `mentor-studio-code`), so anchor only the trailing
// UUID and accept anything ASCII-safe in front.
const WSID_WITH_PREFIX = /^[a-z0-9-]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("ensureWorkspaceId", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wsid-"));
    configPath = join(dir, "config.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns existing workspaceId unchanged", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({ workspaceId: "existing-123", locale: "ja" }, null, 2),
    );
    const id = await ensureWorkspaceId(configPath);
    expect(id).toBe("existing-123");
    const reread = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(reread.workspaceId).toBe("existing-123");
    expect(reread.locale).toBe("ja");
  });

  it("replaces an invalid existing workspaceId with a safe generated one", async () => {
    writeFileSync(
      configPath,
      JSON.stringify(
        { workspaceId: "../../outside", repositoryName: "my-project" },
        null,
        2,
      ),
    );
    const id = await ensureWorkspaceId(configPath);
    expect(id).toMatch(WSID_WITH_PREFIX);
    expect(isValidWorkspaceId(id)).toBe(true);
    const reread = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(reread.workspaceId).toBe(id);
  });

  it("generates and persists a prefixed id from repositoryName when missing", async () => {
    writeFileSync(
      configPath,
      JSON.stringify(
        { locale: "ja", repositoryName: "mentor-studio-code" },
        null,
        2,
      ),
    );
    const id = await ensureWorkspaceId(configPath);
    expect(id).toMatch(WSID_WITH_PREFIX);
    expect(id.startsWith("mentor-studio-code-")).toBe(true);
    const reread = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(reread.workspaceId).toBe(id);
    expect(reread.locale).toBe("ja"); // preserved
    expect(reread.repositoryName).toBe("mentor-studio-code"); // preserved
  });

  it("falls back to UUID-only when repositoryName sanitizes to empty", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({ repositoryName: "メンター学習" }, null, 2),
    );
    const id = await ensureWorkspaceId(configPath);
    expect(id).toMatch(UUID_ONLY);
  });

  it("falls back to UUID-only when repositoryName is missing", async () => {
    writeFileSync(configPath, JSON.stringify({ locale: "ja" }, null, 2));
    const id = await ensureWorkspaceId(configPath);
    expect(id).toMatch(UUID_ONLY);
  });

  it("generates a prefixed id when workspaceId field is empty string", async () => {
    writeFileSync(
      configPath,
      JSON.stringify(
        { workspaceId: "", repositoryName: "my-project" },
        null,
        2,
      ),
    );
    const id = await ensureWorkspaceId(configPath);
    expect(id).toMatch(WSID_WITH_PREFIX);
    expect(id.startsWith("my-project-")).toBe(true);
  });

  it("throws WorkspaceIdConfigMissingError when config.json does not exist", async () => {
    await expect(ensureWorkspaceId(configPath)).rejects.toBeInstanceOf(
      WorkspaceIdConfigMissingError,
    );
  });

  it("two calls return the same id (idempotent)", async () => {
    writeFileSync(configPath, JSON.stringify({}, null, 2));
    const a = await ensureWorkspaceId(configPath);
    const b = await ensureWorkspaceId(configPath);
    expect(a).toBe(b);
  });

  it("concurrent calls converge on a single id (no orphaning)", async () => {
    writeFileSync(configPath, JSON.stringify({ locale: "ja" }, null, 2));
    // Kick off N parallel calls; the sentinel must serialize generation so
    // every caller observes the same id and the disk holds exactly one id.
    const results = await Promise.all(
      Array.from({ length: 6 }, () => ensureWorkspaceId(configPath)),
    );
    const unique = new Set(results);
    expect(unique.size).toBe(1);
    const persisted = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(persisted.workspaceId).toBe(results[0]);
    expect(persisted.locale).toBe("ja");
  });

  it("recovers from a stale sentinel left by a prior crashed process", async () => {
    writeFileSync(configPath, JSON.stringify({}, null, 2));
    // Pre-create the sentinel as if a prior window crashed mid-generation.
    // The poll loop should time out, clear the sentinel, and self-recover.
    const fs = await import("node:fs");
    fs.mkdirSync(configPath + ".wsid-gen.lock");
    const id = await ensureWorkspaceId(configPath);
    expect(id).toMatch(UUID_ONLY);
    expect(fs.existsSync(configPath + ".wsid-gen.lock")).toBe(false);
  }, 10_000);
});

describe("sanitizeRepoNameForPath", () => {
  it("lowercases and replaces non-[a-z0-9] runs with a single dash", () => {
    expect(sanitizeRepoNameForPath("My Repo")).toBe("my-repo");
    expect(sanitizeRepoNameForPath("Mentor Studio Code")).toBe(
      "mentor-studio-code",
    );
    expect(sanitizeRepoNameForPath("a/b\\c:d")).toBe("a-b-c-d");
    expect(sanitizeRepoNameForPath("foo___bar")).toBe("foo-bar");
  });

  it("trims leading and trailing dashes", () => {
    expect(sanitizeRepoNameForPath("-foo-")).toBe("foo");
    expect(sanitizeRepoNameForPath("...repo...")).toBe("repo");
  });

  it("returns empty string for all non-ASCII names", () => {
    expect(sanitizeRepoNameForPath("メンター学習")).toBe("");
    expect(sanitizeRepoNameForPath("")).toBe("");
  });

  it("caps length at 64 characters and trims any trailing dash from the cut", () => {
    const long = "a".repeat(80);
    expect(sanitizeRepoNameForPath(long)).toBe("a".repeat(64));
    // A `-` falling exactly at position 64 would otherwise leave a trailing
    // dash after the slice; verify it is trimmed.
    const withCutDash = "a".repeat(63) + "-bbbb";
    expect(sanitizeRepoNameForPath(withCutDash).endsWith("-")).toBe(false);
  });
});
