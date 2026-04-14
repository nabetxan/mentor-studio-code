import { addTopic } from "./addTopic";
import { listTopics } from "./listTopics";
import { listUnresolved } from "./listUnresolved";
import { recordAnswer } from "./recordAnswer";
import { sessionBrief } from "./sessionBrief";
import type { CommandMap } from "./types";
import { updateConfig } from "./updateConfig";
import { updateProfile } from "./updateProfile";
import { updateProgress } from "./updateProgress";
import { updateTask } from "./updateTask";

export * from "./types";

export const COMMANDS: CommandMap = {
  "add-topic": addTopic,
  "list-topics": listTopics,
  "list-unresolved": listUnresolved,
  "record-answer": recordAnswer,
  "session-brief": sessionBrief,
  "update-config": updateConfig,
  "update-profile": updateProfile,
  "update-progress": updateProgress,
  "update-task": updateTask,
};
