import type { Database } from "sql.js";

import { selectActiveTask, type ActiveTask } from "./activeTask";

export interface ImplementationReviewOutput {
  currentTask: ActiveTask | null;
  resumeContext: string | null;
}

export function implementationReviewBrief(
  db: Database,
  resumeContext: string | null,
): ImplementationReviewOutput {
  return {
    currentTask: selectActiveTask(db),
    resumeContext,
  };
}
