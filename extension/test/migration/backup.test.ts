import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createBackups,
  MigrationBackupError,
} from "../../src/migration/backup";

function mkMentor(): string {
  const root = mkdtempSync(join(tmpdir(), "msc-bak-"));
  mkdirSync(join(root, ".mentor"));
  return join(root, ".mentor");
}

describe("createBackups", () => {
  it("backs up all three files when present", async () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "question-history.json"), "[]");
    writeFileSync(join(mentor, "progress.json"), "{}");
    writeFileSync(join(mentor, "config.json"), "{}");
    const created = await createBackups(mentor);
    expect(created).toHaveLength(3);
    expect(existsSync(join(mentor, "question-history.json.bak"))).toBe(true);
    expect(existsSync(join(mentor, "progress.json.bak"))).toBe(true);
    expect(existsSync(join(mentor, "config.json.bak"))).toBe(true);
  });

  it("skips files that do not exist", async () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "question-history.json"), "[]");
    const created = await createBackups(mentor);
    expect(created).toHaveLength(1);
    expect(existsSync(join(mentor, "progress.json.bak"))).toBe(false);
  });

  it("overwrites existing .bak every time", async () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "question-history.json"), "new");
    writeFileSync(join(mentor, "question-history.json.bak"), "old");
    await createBackups(mentor);
    expect(
      readFileSync(join(mentor, "question-history.json.bak"), "utf-8"),
    ).toBe("new");
  });

  it("throws MigrationBackupError when copy fails", async () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "config.json"), "{}");
    // Make .bak a directory so copyFile fails with EISDIR
    mkdirSync(join(mentor, "config.json.bak"));
    await expect(createBackups(mentor)).rejects.toBeInstanceOf(
      MigrationBackupError,
    );
  });
});
