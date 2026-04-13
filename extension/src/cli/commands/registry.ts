import { addTopic } from "./addTopic";
import { listTopics } from "./listTopics";
import { listUnresolved } from "./listUnresolved";
import { recordAnswer } from "./recordAnswer";
import { sessionBrief } from "./sessionBrief";
import type { CommandMap } from "./types";

export * from "./types";

export const COMMANDS: CommandMap = {
  "add-topic": addTopic,
  "list-topics": listTopics,
  "list-unresolved": listUnresolved,
  "record-answer": recordAnswer,
  "session-brief": sessionBrief,
};
