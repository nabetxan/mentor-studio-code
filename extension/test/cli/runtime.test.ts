import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cliPath = join(__dirname, "..", "..", "dist", "mentor-cli.cjs");

function runCli(args: string[]): { code: number | null; stdout: string } {
  const res = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf-8",
  });
  return { code: res.status, stdout: res.stdout };
}

describe("mentor-cli runtime", () => {
  it("exits 1 with no_command when invoked with no args", () => {
    const { code, stdout } = runCli([]);
    expect(code).toBe(1);
    expect(JSON.parse(stdout.trim())).toMatchObject({
      ok: false,
      error: "no_command",
    });
  });

  it("exits 1 with unknown_command for unregistered command", () => {
    const { code, stdout } = runCli(["not-a-command"]);
    expect(code).toBe(1);
    expect(JSON.parse(stdout.trim())).toMatchObject({
      ok: false,
      error: "unknown_command",
      detail: "not-a-command",
    });
  });

  it("returns workspace_not_initialized when no config.json exists for a known command", () => {
    // The CLI lives at <repo>/extension/dist/mentor-cli.cjs, so resolvePaths
    // computes mentorRoot=<repo>/extension and configPath=<repo>/extension/config.json,
    // which does not exist — triggering WorkspaceNotInitializedError.
    const { code, stdout } = runCli(["list-topics"]);
    expect(code).toBe(1);
    const out = JSON.parse(stdout.trim()) as Record<string, unknown>;
    expect(out).toMatchObject({
      ok: false,
      error: "workspace_not_initialized",
    });
    expect(typeof out.configPath).toBe("string");
  });
});
