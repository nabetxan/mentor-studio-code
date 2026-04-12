import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePaths } from "../../src/cli/context";

describe("resolvePaths", () => {
  it("derives .mentor paths from tools dir", () => {
    const mentorRoot = mkdtempSync(join(tmpdir(), "msc-ctx-"));
    const toolsDir = join(mentorRoot, "tools");
    mkdirSync(toolsDir);
    const p = resolvePaths(toolsDir);
    expect(p.mentorRoot).toBe(mentorRoot);
    expect(p.dbPath).toBe(join(mentorRoot, "data.db"));
    expect(p.progressPath).toBe(join(mentorRoot, "progress.json"));
    expect(p.wasmPath).toBe(join(toolsDir, "sql-wasm.wasm"));
  });
});
