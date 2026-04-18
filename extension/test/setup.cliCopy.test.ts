import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyCliArtifacts } from "../src/commands/setup";

function sha(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

import { writeFileSync } from "node:fs";

describe("copyCliArtifacts", () => {
  it("copies mentor-cli.cjs byte-for-byte and does not ship sql-wasm.wasm", async () => {
    const dist = join(__dirname, "..", "dist");
    const target = mkdtempSync(join(tmpdir(), "msc-setup-"));
    await copyCliArtifacts(dist, target);
    expect(existsSync(join(target, "mentor-cli.cjs"))).toBe(true);
    expect(existsSync(join(target, "sql-wasm.wasm"))).toBe(false);
    expect(sha(join(target, "mentor-cli.cjs"))).toBe(
      sha(join(dist, "mentor-cli.cjs")),
    );
  });

  it("removes legacy mentor-cli.js left over from pre-0.6.2 installs", async () => {
    const dist = join(__dirname, "..", "dist");
    const target = mkdtempSync(join(tmpdir(), "msc-setup-legacy-"));
    writeFileSync(join(target, "mentor-cli.js"), "legacy");
    await copyCliArtifacts(dist, target);
    expect(existsSync(join(target, "mentor-cli.js"))).toBe(false);
    expect(existsSync(join(target, "mentor-cli.cjs"))).toBe(true);
  });
});
