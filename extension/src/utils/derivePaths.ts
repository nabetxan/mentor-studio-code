import * as os from "node:os";
import { join } from "node:path";
import {
  getExternalDataDirFor,
  getExternalDataDirForWorkspaceFor,
  getExternalDbPathFor,
} from "./dataPath";

export interface DerivePathsInput {
  workspaceRoot: string;
  workspaceId: string | null;
  mentorPath?: string;
}

export interface DerivePathsForInput extends DerivePathsInput {
  platform: NodeJS.Platform | string;
  env: NodeJS.ProcessEnv;
  homeDir: string;
}

export interface DerivedPaths {
  mentorRoot: string;
  configPath: string;
  /** Effective DB path the rest of the system should use. External when workspaceId is set, else legacy in-workspace. */
  dbPath: string;
  /** External DB path (null if workspaceId is null). */
  externalDbPath: string | null;
  externalDataDir: string;
  externalDataDirForWorkspace: string | null;
  /** Legacy in-workspace path; useful for migration code regardless of workspaceId state. */
  legacyInWorkspaceDbPath: string;
}

/** Pure variant — used directly by tests. */
export function derivePathsFor(input: DerivePathsForInput): DerivedPaths {
  const mentorPath = input.mentorPath ?? ".mentor";
  const mentorRoot = join(input.workspaceRoot, mentorPath);
  const configPath = join(mentorRoot, "config.json");
  const legacyInWorkspaceDbPath = join(mentorRoot, "data.db");
  const externalDataDir = getExternalDataDirFor(
    input.platform,
    input.env,
    input.homeDir,
  );
  if (input.workspaceId) {
    const externalDbPath = getExternalDbPathFor(
      input.platform,
      input.env,
      input.homeDir,
      input.workspaceId,
    );
    return {
      mentorRoot,
      configPath,
      dbPath: externalDbPath,
      externalDbPath,
      externalDataDir,
      externalDataDirForWorkspace: getExternalDataDirForWorkspaceFor(
        input.platform,
        input.env,
        input.homeDir,
        input.workspaceId,
      ),
      legacyInWorkspaceDbPath,
    };
  }
  return {
    mentorRoot,
    configPath,
    dbPath: legacyInWorkspaceDbPath,
    externalDbPath: null,
    externalDataDir,
    externalDataDirForWorkspace: null,
    legacyInWorkspaceDbPath,
  };
}

export function deriveHomeDirForWorkspaceFor(
  platform: NodeJS.Platform | string,
  processHomeDir: string,
  workspaceRoot: string,
): string {
  if (platform !== "darwin") return processHomeDir;
  const parts = workspaceRoot.split("/");
  if (parts[0] === "" && parts[1] === "Users" && parts[2]) {
    return join("/", "Users", parts[2]);
  }
  return processHomeDir;
}

/** Public wrapper — reads process state once. */
export function derivePaths(input: DerivePathsInput): DerivedPaths {
  const platform = process.platform;
  return derivePathsFor({
    ...input,
    platform,
    env: process.env,
    homeDir: deriveHomeDirForWorkspaceFor(
      platform,
      os.homedir(),
      input.workspaceRoot,
    ),
  });
}
