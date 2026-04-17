import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cliPath = join(__dirname, "..", "..", "dist", "mentor-cli.js");

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
});
