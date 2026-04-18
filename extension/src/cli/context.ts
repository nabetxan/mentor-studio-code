import { join, resolve } from "node:path";

export interface CliPaths {
  mentorRoot: string;
  dbPath: string;
  progressPath: string;
  configPath: string;
}

export function resolvePaths(toolsDir: string): CliPaths {
  const mentorRoot = resolve(toolsDir, "..");
  return {
    mentorRoot,
    dbPath: join(mentorRoot, "data.db"),
    progressPath: join(mentorRoot, "progress.json"),
    configPath: join(mentorRoot, "config.json"),
  };
}
