import { existsSync } from "node:fs";
import { bootstrapDb, type BootstrapOptions } from "./bootstrap";
import * as integrity from "./integrity";

export interface OpenOptions {
  wasmPath: string;
  bootstrap?: { topics: BootstrapOptions["topics"] };
}

export interface OpenResult {
  created: boolean;
  dbPath: string;
}

export class DbCorruptError extends Error {
  constructor(
    public readonly quarantinedPath: string,
    public readonly reason: string,
  ) {
    super(`DB corrupt (reason: ${reason}); quarantined to ${quarantinedPath}`);
    this.name = "DbCorruptError";
  }
}

export async function openDb(
  dbPath: string,
  opts: OpenOptions,
): Promise<OpenResult> {
  if (!existsSync(dbPath)) {
    if (!opts.bootstrap) {
      throw new Error(
        `DB not found at ${dbPath} and no bootstrap option provided`,
      );
    }
    await bootstrapDb(dbPath, {
      wasmPath: opts.wasmPath,
      topics: opts.bootstrap.topics,
    });
    return { created: true, dbPath };
  }
  const integ = await integrity.checkIntegrity(dbPath, opts.wasmPath);
  if (integ.ok) {
    return { created: false, dbPath };
  }
  try {
    const quarantined = await integrity.quarantineCorruptDb(dbPath);
    throw new DbCorruptError(quarantined, integ.reason);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      if (!opts.bootstrap) {
        throw new Error(
          `DB not found at ${dbPath} and no bootstrap option provided`,
        );
      }
      await bootstrapDb(dbPath, {
        wasmPath: opts.wasmPath,
        topics: opts.bootstrap.topics,
      });
      return { created: true, dbPath };
    }
    throw err;
  }
}
