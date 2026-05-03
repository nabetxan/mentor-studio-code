import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("extension package scripts", () => {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, "../package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
  };

  it("runs vitest through a repo script instead of the bin shebang", () => {
    expect(pkg.scripts?.test).toMatch(/run-vitest\.sh run/);
    expect(pkg.scripts?.["test:watch"]).toMatch(/run-vitest\.sh/);
    expect(pkg.scripts?.test).not.toBe("vitest run");
    expect(pkg.scripts?.["test:watch"]).not.toBe("vitest");
  });
});

describe("webview package scripts", () => {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, "../../extension/webview/package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
  };

  it("runs vitest through a repo script instead of the bin shebang", () => {
    expect(pkg.scripts?.test).toMatch(/run-vitest\.sh run/);
    expect(pkg.scripts?.test).not.toBe("vitest run");
  });
});
