import type { Database } from "sql.js";

import { selectActiveTask, type ActiveTask } from "./activeTask";

export interface ImplementationReviewOutput {
  currentTask: ActiveTask | null;
  resumeContext: string | null;
}

export function implementationReviewBrief(
  db: Database,
  progress: Record<string, unknown>,
): ImplementationReviewOutput {
  const resumeContext = progress.resume_context;
  return {
    currentTask: selectActiveTask(db),
    resumeContext: typeof resumeContext === "string" ? resumeContext : null,
  };
}
