import * as os from "node:os"; // namespace import so vi.spyOn(os, "homedir") reaches us
import { join } from "node:path";
import { isValidWorkspaceId } from "./workspaceId";

export class InvalidWorkspaceIdError extends Error {
  constructor(public readonly workspaceId: string) {
    super(`Invalid workspaceId: ${workspaceId}`);
    this.name = "InvalidWorkspaceIdError";
  }
}

function assertValidWorkspaceId(workspaceId: string): void {
  if (!isValidWorkspaceId(workspaceId)) {
    throw new InvalidWorkspaceIdError(workspaceId);
  }
}

/**
 * Pure variant — takes platform/env/home as arguments so unit tests don't
 * have to mutate global state. Use this from tests; production callers use
 * the public wrappers below.
 */
export function getExternalDataDirFor(
  platform: NodeJS.Platform | string,
  env: NodeJS.ProcessEnv,
  homeDir: string,
): string {
  if (platform === "darwin") {
    return join(homeDir, "Library", "Application Support", "MentorStudioCode");
  }
  if (platform === "win32") {
    const appData = env.APPDATA && env.APPDATA.length > 0
      ? env.APPDATA
      : join(homeDir, "AppData", "Roaming");
    return join(appData, "MentorStudioCode");
  }
  // Linux/other: XDG spec
  const xdg = env.XDG_DATA_HOME && env.XDG_DATA_HOME.length > 0
    ? env.XDG_DATA_HOME
    : join(homeDir, ".local", "share");
  return join(xdg, "mentor-studio-code");
}

export function getExternalDataDirForWorkspaceFor(
  platform: NodeJS.Platform | string,
  env: NodeJS.ProcessEnv,
  homeDir: string,
  workspaceId: string,
): string {
  assertValidWorkspaceId(workspaceId);
  return join(getExternalDataDirFor(platform, env, homeDir), workspaceId);
}

export function getExternalDbPathFor(
  platform: NodeJS.Platform | string,
  env: NodeJS.ProcessEnv,
  homeDir: string,
  workspaceId: string,
): string {
  assertValidWorkspaceId(workspaceId);
  return join(
    getExternalDataDirForWorkspaceFor(platform, env, homeDir, workspaceId),
    "data.db",
  );
}

/** Public wrappers — read process state once at call time. */
export function getExternalDataDir(): string {
  return getExternalDataDirFor(process.platform, process.env, os.homedir());
}

export function getExternalDataDirForWorkspace(workspaceId: string): string {
  return getExternalDataDirForWorkspaceFor(
    process.platform,
    process.env,
    os.homedir(),
    workspaceId,
  );
}

export function getExternalDbPath(workspaceId: string): string {
  return getExternalDbPathFor(process.platform, process.env, os.homedir(), workspaceId);
}
