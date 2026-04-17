import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CLI bundle", () => {
  const cliPath = join(__dirname, "..", "dist", "mentor-cli.js");

  it("builds extension/dist/mentor-cli.js", () => {
    expect(existsSync(cliPath)).toBe(true);
    expect(statSync(cliPath).size).toBeGreaterThan(1_000);
  });

  it("starts with the node shebang", () => {
    const src = readFileSync(cliPath, "utf-8");
    expect(src.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("bundles sql.js (no external require of sql.js)", () => {
    const src = readFileSync(cliPath, "utf-8");
    expect(src.includes("require('sql.js')")).toBe(false);
    expect(src.includes('require("sql.js")')).toBe(false);
  });
});
