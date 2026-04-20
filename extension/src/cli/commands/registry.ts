import { activatePlan } from "./activatePlan";
import { activateTask } from "./activateTask";
import { addPlan } from "./addPlan";
import { addTask } from "./addTask";
import { addTopic } from "./addTopic";
import { deactivatePlan } from "./deactivatePlan";
import { deletePlan } from "./deletePlan";
import { listPlans } from "./listPlans";
import { listTopics } from "./listTopics";
import { listUnresolved } from "./listUnresolved";
import { recordAnswer } from "./recordAnswer";
import { removePlan } from "./removePlan";
import { sessionBrief } from "./sessionBrief";
import type { CommandMap } from "./types";
import { updateConfig } from "./updateConfig";
import { updatePlan } from "./updatePlan";
import { updateProfile } from "./updateProfile";
import { updateProgress } from "./updateProgress";
import { updateTask } from "./updateTask";

export * from "./types";

export const COMMANDS: CommandMap = {
  "activate-plan": activatePlan,
  "activate-task": activateTask,
  "add-plan": addPlan,
  "add-task": addTask,
  "add-topic": addTopic,
  "deactivate-plan": deactivatePlan,
  "delete-plan": deletePlan,
  "list-plans": listPlans,
  "list-topics": listTopics,
  "list-unresolved": listUnresolved,
  "record-answer": recordAnswer,
  "remove-plan": removePlan,
  "session-brief": sessionBrief,
  "update-config": updateConfig,
  "update-plan": updatePlan,
  "update-profile": updateProfile,
  "update-progress": updateProgress,
  "update-task": updateTask,
};
