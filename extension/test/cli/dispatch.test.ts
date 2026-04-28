import { describe, expect, it } from "vitest";
import type { CliPaths } from "../../src/cli/context";
import { dispatch } from "../../src/cli/main";
import { DbCorruptError } from "../../src/db";

const paths: CliPaths = {
  mentorRoot: "/tmp/fake",
  dbPath: "/tmp/fake/data.db",
  configPath: "/tmp/fake/config.json",
};

describe("dispatch", () => {
  it("returns unknown_command for unregistered command", async () => {
    const out = await dispatch({
      command: "nope",
      argJson: undefined,
      paths,
      commands: {},
    });
    expect(out).toMatchObject({
      ok: false,
      error: "unknown_command",
      detail: "nope",
    });
  });

  it("returns invalid_json on malformed argJson", async () => {
    const out = await dispatch({
      command: "x",
      argJson: "{bad",
      paths,
      commands: { x: async () => ({ ok: true }) },
    });
    expect(out).toMatchObject({ ok: false, error: "invalid_json" });
  });

  it('maps DbCorruptError thrown by handler to {error:"db_corrupt"}', async () => {
    const out = await dispatch({
      command: "x",
      argJson: "{}",
      paths,
      commands: {
        x: async () => {
          throw new DbCorruptError(
            "/tmp/data.db.corrupt-xxx",
            "integrity_check",
          );
        },
      },
    });
    expect(out).toMatchObject({
      ok: false,
      error: "db_corrupt",
      path: "/tmp/data.db.corrupt-xxx",
      reason: "integrity_check",
    });
  });

  it("maps unexpected errors with detail", async () => {
    const out = await dispatch({
      command: "x",
      argJson: "{}",
      paths,
      commands: {
        x: async () => {
          throw new Error("boom");
        },
      },
    });
    expect(out).toMatchObject({
      ok: false,
      error: "unexpected",
      detail: "boom",
    });
  });

  it("maps WorkspaceNotInitializedError to { ok: false, error: 'workspace_not_initialized' }", async () => {
    const commands = {
      failingCommand: async () => {
        const { WorkspaceNotInitializedError } = await import(
          "../../src/cli/context.js"
        );
        throw new WorkspaceNotInitializedError("/fake/.mentor/config.json");
      },
    };
    const result = await dispatch({
      command: "failingCommand",
      argJson: undefined,
      paths: { mentorRoot: "/x", dbPath: "/x/d", configPath: "/x/c" },
      commands,
    });
    expect(result).toMatchObject({
      ok: false,
      error: "workspace_not_initialized",
    });
  });
});
