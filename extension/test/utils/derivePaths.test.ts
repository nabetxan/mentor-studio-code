import { describe, expect, it } from "vitest";
import { derivePathsFor } from "../../src/utils/derivePaths";

const FAKE_PLATFORM = "darwin" as const;
const FAKE_ENV = {};
const FAKE_HOME = "/fake/home";

describe("derivePaths", () => {
  it("returns external dbPath when workspaceId is provided", () => {
    const paths = derivePathsFor({
      workspaceRoot: "/ws",
      workspaceId: "repo-11111111-1111-1111-1111-111111111111",
      platform: FAKE_PLATFORM,
      env: FAKE_ENV,
      homeDir: FAKE_HOME,
    });
    expect(paths.mentorRoot).toBe("/ws/.mentor");
    expect(paths.configPath).toBe("/ws/.mentor/config.json");
    expect(paths.dbPath).toBe(
      "/fake/home/Library/Application Support/MentorStudioCode/repo-11111111-1111-1111-1111-111111111111/data.db",
    );
    expect(paths.externalDataDirForWorkspace).toBe(
      "/fake/home/Library/Application Support/MentorStudioCode/repo-11111111-1111-1111-1111-111111111111",
    );
    expect(paths.legacyInWorkspaceDbPath).toBe("/ws/.mentor/data.db");
  });

  it("throws when workspaceId is invalid", () => {
    expect(() =>
      derivePathsFor({
        workspaceRoot: "/ws",
        workspaceId: "../../evil",
        platform: FAKE_PLATFORM,
        env: FAKE_ENV,
        homeDir: FAKE_HOME,
      }),
    ).toThrow();
  });

  it("falls back to in-workspace dbPath when workspaceId is null", () => {
    const paths = derivePathsFor({
      workspaceRoot: "/ws",
      workspaceId: null,
      platform: FAKE_PLATFORM,
      env: FAKE_ENV,
      homeDir: FAKE_HOME,
    });
    expect(paths.dbPath).toBe("/ws/.mentor/data.db");
    expect(paths.externalDbPath).toBeNull();
    expect(paths.externalDataDirForWorkspace).toBeNull();
  });

  it("respects custom mentorPath", () => {
    const paths = derivePathsFor({
      workspaceRoot: "/ws",
      workspaceId: null,
      mentorPath: ".custom-mentor",
      platform: FAKE_PLATFORM,
      env: FAKE_ENV,
      homeDir: FAKE_HOME,
    });
    expect(paths.mentorRoot).toBe("/ws/.custom-mentor");
    expect(paths.configPath).toBe("/ws/.custom-mentor/config.json");
    expect(paths.dbPath).toBe("/ws/.custom-mentor/data.db");
  });
});
