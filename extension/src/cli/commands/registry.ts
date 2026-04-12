import type { CliPaths } from "../context";

export type CommandOk = { ok: true; [k: string]: unknown };
export type CommandFail = { ok: false; error: string; [k: string]: unknown };
export type CommandResult = CommandOk | CommandFail;
export type Command = (
  args: unknown,
  paths: CliPaths,
) => Promise<CommandResult>;
export type CommandMap = Record<string, Command>;

export const COMMANDS: CommandMap = {};
