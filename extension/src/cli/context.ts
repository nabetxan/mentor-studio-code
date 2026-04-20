import { join, resolve } from "node:path";

export interface CliPaths {
  mentorRoot: string;
  dbPath: string;
  configPath: string;
}

export function resolvePaths(toolsDir: string): CliPaths {
  const mentorRoot = resolve(toolsDir, "..");
  return {
    mentorRoot,
    dbPath: join(mentorRoot, "data.db"),
    configPath: join(mentorRoot, "config.json"),
  };
}
