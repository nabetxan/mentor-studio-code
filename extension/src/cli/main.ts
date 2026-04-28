// mentor-cli: SQLite-backed CLI used by the AI during mentor sessions.
// Built as a separate esbuild entry; runtime path: .mentor/tools/mentor-cli.cjs

import { DbCorruptError } from "../db";
import {
  COMMANDS,
  type CommandMap,
  type CommandResult,
} from "./commands/registry";
import {
  resolvePaths,
  WorkspaceNotInitializedError,
  type CliPaths,
} from "./context";

export interface DispatchInput {
  command: string;
  argJson: string | undefined;
  paths: CliPaths;
  commands: CommandMap;
}

export async function dispatch(input: DispatchInput): Promise<CommandResult> {
  const handler = input.commands[input.command];
  if (!handler) {
    return { ok: false, error: "unknown_command", detail: input.command };
  }
  let args: unknown = undefined;
  if (input.argJson != null && input.argJson !== "") {
    try {
      args = JSON.parse(input.argJson);
    } catch (e) {
      return { ok: false, error: "invalid_json", detail: (e as Error).message };
    }
  }
  try {
    return await handler(args, input.paths);
  } catch (e) {
    if (e instanceof WorkspaceNotInitializedError) {
      return {
        ok: false,
        error: "workspace_not_initialized",
        detail: e.message,
        configPath: e.configPath,
      };
    }
    if (e instanceof DbCorruptError) {
      return {
        ok: false,
        error: "db_corrupt",
        path: e.quarantinedPath,
        reason: e.reason,
      };
    }
    return {
      ok: false,
      error: "unexpected",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function main(argv: string[]): Promise<void> {
  const [, , command, argJson] = argv;
  if (!command) {
    process.stdout.write(
      JSON.stringify({ ok: false, error: "no_command" }) + "\n",
    );
    process.exitCode = 1;
    return;
  }
  // Verify command existence BEFORE resolving paths so unknown_command
  // short-circuits without requiring an initialized workspace.
  if (!(command in COMMANDS)) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: "unknown_command",
        detail: command,
      }) + "\n",
    );
    process.exitCode = 1;
    return;
  }
  let paths: CliPaths;
  try {
    paths = resolvePaths(__dirname);
  } catch (e) {
    if (e instanceof WorkspaceNotInitializedError) {
      process.stdout.write(
        JSON.stringify({
          ok: false,
          error: "workspace_not_initialized",
          detail: e.message,
          configPath: e.configPath,
        }) + "\n",
      );
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  const result = await dispatch({
    command,
    argJson,
    paths,
    commands: COMMANDS,
  });
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!result.ok) process.exitCode = 1;
}
