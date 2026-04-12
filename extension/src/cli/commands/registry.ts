import { listTopics } from "./listTopics";
import { listUnresolved } from "./listUnresolved";
import { sessionBrief } from "./sessionBrief";
import type { CommandMap } from "./types";

export * from "./types";

export const COMMANDS: CommandMap = {
  "list-topics": listTopics,
  "list-unresolved": listUnresolved,
  "session-brief": sessionBrief,
};
