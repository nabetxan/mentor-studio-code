import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyCliArtifacts } from "../src/commands/setup";

function sha(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

describe("copyCliArtifacts", () => {
  it("copies mentor-cli.js and sql-wasm.wasm byte-for-byte", async () => {
    const dist = join(__dirname, "..", "dist");
    const target = mkdtempSync(join(tmpdir(), "msc-setup-"));
    await copyCliArtifacts(dist, target);
    expect(existsSync(join(target, "mentor-cli.js"))).toBe(true);
    expect(existsSync(join(target, "sql-wasm.wasm"))).toBe(true);
    expect(sha(join(target, "mentor-cli.js"))).toBe(
      sha(join(dist, "mentor-cli.js")),
    );
    expect(sha(join(target, "sql-wasm.wasm"))).toBe(
      sha(join(dist, "sql-wasm.wasm")),
    );
  });
});
