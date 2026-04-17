import {
  existsSync,
  mkdtempSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as integrity from "../../src/db/integrity";
import { openDb } from "../../src/db/open";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

describe("openDb", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "open-"));
  });

  it("bootstraps when DB missing and bootstrap option provided", async () => {
    const dbPath = join(dir, "data.db");
    const result = await openDb(dbPath, {
      wasmPath: WASM,
      bootstrap: { topics: [{ label: "JS" }] },
    });
    expect(result.created).toBe(true);
    expect(existsSync(dbPath)).toBe(true);
  });

  it("returns existing DB when healthy", async () => {
    const dbPath = join(dir, "data.db");
    await openDb(dbPath, { wasmPath: WASM, bootstrap: { topics: [] } });
    const result = await openDb(dbPath, {
      wasmPath: WASM,
      bootstrap: { topics: [] },
    });
    expect(result.created).toBe(false);
  });

  it("quarantines corrupt DB and throws", async () => {
    const dbPath = join(dir, "data.db");
    writeFileSync(dbPath, Buffer.from("garbage"));
    await expect(
      openDb(dbPath, { wasmPath: WASM, bootstrap: { topics: [] } }),
    ).rejects.toThrow(/corrupt/i);
    expect(existsSync(dbPath)).toBe(false);
    const entries = readdirSync(dir);
    expect(entries.some((e) => e.startsWith("data.db.corrupt-"))).toBe(true);
  });

  it("throws when DB missing and no bootstrap option", async () => {
    const dbPath = join(dir, "data.db");
    await expect(openDb(dbPath, { wasmPath: WASM })).rejects.toThrow(
      /not found/i,
    );
  });

  it("re-bootstraps when file disappears between integrity check and quarantine (ENOENT race)", async () => {
    const dbPath = join(dir, "data.db");
    writeFileSync(dbPath, Buffer.from("garbage"));
    const spy = vi
      .spyOn(integrity, "quarantineCorruptDb")
      .mockImplementation(async () => {
        unlinkSync(dbPath);
        const err = new Error("ENOENT: race") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      });
    try {
      const result = await openDb(dbPath, {
        wasmPath: WASM,
        bootstrap: { topics: [] },
      });
      expect(result.created).toBe(true);
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });
});
