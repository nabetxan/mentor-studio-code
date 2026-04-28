import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolvePaths,
  WorkspaceNotInitializedError,
} from "../../src/cli/context";

describe("resolvePaths", () => {
  let workspaceRoot: string;
  let mentorRoot: string;
  let toolsDir: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), "ctx-"));
    mentorRoot = join(workspaceRoot, ".mentor");
    toolsDir = join(mentorRoot, "tools");
    mkdirSync(toolsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it("resolves dbPath to external location when workspaceId is in config.json", () => {
    writeFileSync(
      join(mentorRoot, "config.json"),
      JSON.stringify({ workspaceId: "uuid-test", locale: "ja" }, null, 2),
    );
    const paths = resolvePaths(toolsDir);
    expect(paths.mentorRoot).toBe(mentorRoot);
    expect(paths.configPath).toBe(join(mentorRoot, "config.json"));
    expect(paths.dbPath).toContain("uuid-test");
    expect(paths.dbPath.endsWith("data.db")).toBe(true);
  });

  it("throws WorkspaceNotInitializedError when config.json is missing", () => {
    expect(() => resolvePaths(toolsDir)).toThrow(WorkspaceNotInitializedError);
  });

  it("throws WorkspaceNotInitializedError when config.json has no workspaceId", () => {
    writeFileSync(
      join(mentorRoot, "config.json"),
      JSON.stringify({ locale: "ja" }, null, 2),
    );
    expect(() => resolvePaths(toolsDir)).toThrow(WorkspaceNotInitializedError);
  });

  it("throws WorkspaceNotInitializedError when config.json is malformed JSON", () => {
    writeFileSync(join(mentorRoot, "config.json"), "{ not valid json");
    expect(() => resolvePaths(toolsDir)).toThrow(WorkspaceNotInitializedError);
  });
});
