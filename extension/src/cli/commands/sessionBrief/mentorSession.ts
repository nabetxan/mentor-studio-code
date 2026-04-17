import type { Database } from "sql.js";

import {
  QUESTION_SELECT_COLUMNS,
  rowToQuestion,
  type Question,
} from "../questionMapper";
import { selectActiveTask, type ActiveTask } from "./activeTask";

export interface MentorSessionOutput {
  currentTask: ActiveTask | null;
  resumeContext: string | null;
  relevantGaps: Question[];
  gapCount: { total: number; filtered: number };
}

export function mentorSessionBrief(
  db: Database,
  progress: Record<string, unknown>,
): MentorSessionOutput {
  const currentTask = selectActiveTask(db);
  const totalRes = db.exec(
    "SELECT COUNT(*) FROM questions WHERE isCorrect = 0",
  );
  const total = Number(totalRes[0]?.values[0][0] ?? 0);
  const gapsRes = db.exec(
    `SELECT ${QUESTION_SELECT_COLUMNS} FROM questions WHERE isCorrect = 0 ORDER BY lastAnsweredAt DESC, id DESC LIMIT 5`,
  );
  const relevantGaps = gapsRes[0]
    ? gapsRes[0].values.map((row) => rowToQuestion(row))
    : [];
  const resumeContext = progress.resume_context;
  return {
    currentTask,
    resumeContext: typeof resumeContext === "string" ? resumeContext : null,
    relevantGaps,
    gapCount: { total, filtered: relevantGaps.length },
  };
}
