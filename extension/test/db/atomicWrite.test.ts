import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { atomicWriteFile } from "../../src/db/atomicWrite";

describe("atomicWriteFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "atomic-"));
  });

  it("writes file via temp + rename", async () => {
    const target = join(dir, "data.bin");
    await atomicWriteFile(target, Buffer.from([1, 2, 3]));
    expect(readFileSync(target)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("leaves no temp files behind on success", async () => {
    const target = join(dir, "data.bin");
    await atomicWriteFile(target, Buffer.from([1, 2, 3]));
    const leftovers = readdirSync(dir).filter((f) => f.startsWith(".tmp-"));
    expect(leftovers).toEqual([]);
  });

  it("overwrites existing file atomically", async () => {
    const target = join(dir, "data.bin");
    await atomicWriteFile(target, Buffer.from([1]));
    await atomicWriteFile(target, Buffer.from([2, 2]));
    expect(readFileSync(target)).toEqual(Buffer.from([2, 2]));
  });
});
