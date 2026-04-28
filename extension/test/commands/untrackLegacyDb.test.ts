import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hasTrackedLegacyDbFiles,
  untrackLegacyDb,
} from "../../src/commands/untrackLegacyDb";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

function gitSilent(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

describe("untrackLegacyDb", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "untrack-"));
    gitSilent(dir, "init", "-q");
    gitSilent(dir, "config", "user.email", "test@example.com");
    gitSilent(dir, "config", "user.name", "Test");
    gitSilent(dir, "config", "commit.gpgsign", "false");
    mkdirSync(join(dir, ".mentor"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("untracks data.db and migrated sidecars without deleting them", async () => {
    writeFileSync(join(dir, ".mentor", "data.db"), "x");
    writeFileSync(join(dir, ".mentor", "data.db.migrated-2026-04-26"), "y");
    gitSilent(
      dir,
      "add",
      ".mentor/data.db",
      ".mentor/data.db.migrated-2026-04-26",
    );
    gitSilent(dir, "commit", "-q", "-m", "seed");

    await untrackLegacyDb(dir);

    // Files still on disk
    const ls = execFileSync("ls", [".mentor"], { cwd: dir, encoding: "utf-8" });
    expect(ls).toContain("data.db");
    expect(ls).toContain("data.db.migrated-2026-04-26");

    // No longer tracked
    const tracked = git(dir, "ls-files", ".mentor/");
    expect(tracked).not.toContain("data.db");
  });

  it("auto-stages .mentor/.gitignore if present so one commit finalizes (N4)", async () => {
    // Seed the legacy db FIRST and commit it (no .gitignore yet so add works).
    writeFileSync(join(dir, ".mentor", "data.db"), "x");
    gitSilent(dir, "add", ".mentor/data.db");
    gitSilent(dir, "commit", "-q", "-m", "seed");

    // Now drop in the new .gitignore (post-migration state) and run untrack.
    writeFileSync(join(dir, ".mentor", ".gitignore"), "*\n!.gitignore\n");

    await untrackLegacyDb(dir);

    // .gitignore should now be staged for the next commit
    const status = git(dir, "diff", "--cached", "--name-only");
    expect(status).toContain(".mentor/.gitignore");
  });

  it("is a no-op when nothing is tracked", async () => {
    await expect(untrackLegacyDb(dir)).resolves.toBeUndefined();
  });

  it("hasTrackedLegacyDbFiles: false on a fresh repo with nothing tracked", async () => {
    expect(await hasTrackedLegacyDbFiles(dir)).toBe(false);
  });

  it("hasTrackedLegacyDbFiles: false when only non-DB files are tracked", async () => {
    writeFileSync(join(dir, ".mentor", "config.json"), "{}");
    gitSilent(dir, "add", ".mentor/config.json");
    gitSilent(dir, "commit", "-q", "-m", "seed");
    expect(await hasTrackedLegacyDbFiles(dir)).toBe(false);
  });

  it("hasTrackedLegacyDbFiles: true when .mentor/data.db is tracked", async () => {
    writeFileSync(join(dir, ".mentor", "data.db"), "x");
    gitSilent(dir, "add", ".mentor/data.db");
    gitSilent(dir, "commit", "-q", "-m", "seed");
    expect(await hasTrackedLegacyDbFiles(dir)).toBe(true);
  });

  it("hasTrackedLegacyDbFiles: true when only a .migrated-* sidecar is tracked", async () => {
    writeFileSync(join(dir, ".mentor", "data.db.migrated-2026-04-25"), "a");
    gitSilent(dir, "add", ".mentor/data.db.migrated-2026-04-25");
    gitSilent(dir, "commit", "-q", "-m", "seed");
    expect(await hasTrackedLegacyDbFiles(dir)).toBe(true);
  });

  it("hasTrackedLegacyDbFiles: false when DB exists on disk but is gitignored (not tracked)", async () => {
    writeFileSync(join(dir, ".mentor", ".gitignore"), "data.db\n");
    writeFileSync(join(dir, ".mentor", "data.db"), "x");
    gitSilent(dir, "add", ".mentor/.gitignore");
    gitSilent(dir, "commit", "-q", "-m", "seed");
    expect(await hasTrackedLegacyDbFiles(dir)).toBe(false);
  });

  it("hasTrackedLegacyDbFiles: false when invoked outside a git repo", async () => {
    const nogit = mkdtempSync(join(tmpdir(), "nogit-"));
    try {
      mkdirSync(join(nogit, ".mentor"));
      writeFileSync(join(nogit, ".mentor", "data.db"), "x");
      expect(await hasTrackedLegacyDbFiles(nogit)).toBe(false);
    } finally {
      rmSync(nogit, { recursive: true, force: true });
    }
  });

  it("untracks files matching the migrated-* glob (no exact path match needed)", async () => {
    // Seed three glob-pattern legacy files. Note: at seed time, we commit them
    // directly — they were never matched by .gitignore historically.
    writeFileSync(join(dir, ".mentor", "data.db.migrated-2026-04-25"), "a");
    writeFileSync(join(dir, ".mentor", "data.db.bak.migrated-2026-04-25"), "b");
    writeFileSync(
      join(dir, ".mentor", "data.db.lock.migrated-2026-04-25"),
      "c",
    );
    gitSilent(
      dir,
      "add",
      ".mentor/data.db.migrated-2026-04-25",
      ".mentor/data.db.bak.migrated-2026-04-25",
      ".mentor/data.db.lock.migrated-2026-04-25",
    );
    gitSilent(dir, "commit", "-q", "-m", "seed glob");

    await untrackLegacyDb(dir);

    const tracked = git(dir, "ls-files", ".mentor/");
    expect(tracked).not.toContain("data.db.migrated-2026-04-25");
    expect(tracked).not.toContain("data.db.bak.migrated-2026-04-25");
    expect(tracked).not.toContain("data.db.lock.migrated-2026-04-25");

    // Files remain on disk
    const ls = execFileSync("ls", [".mentor"], { cwd: dir, encoding: "utf-8" });
    expect(ls).toContain("data.db.migrated-2026-04-25");
    expect(ls).toContain("data.db.bak.migrated-2026-04-25");
    expect(ls).toContain("data.db.lock.migrated-2026-04-25");
  });
});
