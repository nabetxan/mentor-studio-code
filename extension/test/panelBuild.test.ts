import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Plan Panel bundle", () => {
  const panelPath = join(__dirname, "..", "dist", "plan-panel.js");

  it("builds extension/dist/plan-panel.js", () => {
    expect(existsSync(panelPath)).toBe(true);
    expect(statSync(panelPath).size).toBeGreaterThan(1_000);
  });
});
