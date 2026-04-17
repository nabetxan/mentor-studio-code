import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanupLegacyTemplates } from "../src/commands/setup";

describe("setup: legacy tracker-format.md cleanup", () => {
  let mentorSessionDir: string;

  beforeEach(() => {
    mentorSessionDir = mkdtempSync(join(tmpdir(), "mentor-session-"));
  });

  afterEach(() => {
    rmSync(mentorSessionDir, { recursive: true, force: true });
  });

  it("deletes tracker-format.md when present", async () => {
    const legacyFile = join(mentorSessionDir, "tracker-format.md");
    writeFileSync(legacyFile, "legacy stub");

    const removed = await cleanupLegacyTemplates(mentorSessionDir);

    expect(removed).toBe(true);
    expect(existsSync(legacyFile)).toBe(false);
  });

  it("is a no-op when tracker-format.md is absent (fresh install)", async () => {
    const removed = await cleanupLegacyTemplates(mentorSessionDir);

    expect(removed).toBe(false);
  });

  it("is a no-op when the mentor-session directory does not exist", async () => {
    const missingDir = join(mentorSessionDir, "does-not-exist");

    const removed = await cleanupLegacyTemplates(missingDir);

    expect(removed).toBe(false);
  });

  it("propagates unexpected fs errors", async () => {
    const legacyFile = join(mentorSessionDir, "tracker-format.md");
    mkdirSync(legacyFile);

    await expect(cleanupLegacyTemplates(mentorSessionDir)).rejects.toThrow();
  });
});
