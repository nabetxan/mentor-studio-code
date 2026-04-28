import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { derivePaths } from "../utils/derivePaths";

export interface CliPaths {
  mentorRoot: string;
  dbPath: string;
  configPath: string;
}

export class WorkspaceNotInitializedError extends Error {
  constructor(public readonly configPath: string) {
    super(
      `Workspace not initialized: workspaceId missing from ${configPath}. ` +
        `Run "Mentor Studio Code: Setup Mentor" in the extension before invoking the CLI.`,
    );
    this.name = "WorkspaceNotInitializedError";
  }
}

export function resolvePaths(toolsDir: string): CliPaths {
  const mentorRoot = resolve(toolsDir, "..");
  const workspaceRoot = dirname(mentorRoot);
  const configPath = join(mentorRoot, "config.json");

  let workspaceId: string | null = null;
  if (existsSync(configPath)) {
    try {
      const obj = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
        string,
        unknown
      >;
      if (typeof obj.workspaceId === "string" && obj.workspaceId.length > 0) {
        workspaceId = obj.workspaceId;
      }
    } catch {
      // Fall through. We'll throw below since workspaceId stayed null.
    }
  }

  if (workspaceId === null) {
    // I4: do NOT fall back to legacy in-workspace dbPath. Stale CLI writes
    // could later be picked up by migration and overwrite real history.
    throw new WorkspaceNotInitializedError(configPath);
  }

  const paths = derivePaths({ workspaceRoot, workspaceId });
  return {
    mentorRoot: paths.mentorRoot,
    dbPath: paths.dbPath,
    configPath: paths.configPath,
  };
}
