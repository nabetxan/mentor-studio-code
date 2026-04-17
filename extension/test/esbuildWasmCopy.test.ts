import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("esbuild WASM copy", () => {
  it("copies sql-wasm.wasm to extension/dist after build", () => {
    const wasmPath = join(__dirname, "..", "dist", "sql-wasm.wasm");
    expect(existsSync(wasmPath)).toBe(true);
    expect(statSync(wasmPath).size).toBeGreaterThan(100_000);
  });
});
