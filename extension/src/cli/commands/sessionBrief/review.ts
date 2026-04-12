import type { Database } from "sql.js";

import {
  QUESTION_SELECT_COLUMNS,
  rowToQuestion,
  type Question,
} from "../questionMapper";

export interface ReviewOutput {
  gaps: Question[];
  gapCount: { total: number; filtered: number };
}

export function reviewBrief(db: Database, topicId?: number): ReviewOutput {
  const totalRes = db.exec(
    "SELECT COUNT(*) FROM questions WHERE isCorrect = 0",
  );
  const total = Number(totalRes[0]?.values[0][0] ?? 0);
  const topicClause = topicId !== undefined ? " AND topicId = ?" : "";
  const sql = `SELECT ${QUESTION_SELECT_COLUMNS} FROM questions WHERE isCorrect = 0${topicClause} ORDER BY lastAnsweredAt ASC, id ASC LIMIT 50`;
  const stmt = db.prepare(sql);
  try {
    if (topicId !== undefined) stmt.bind([topicId]);
    const gaps: Question[] = [];
    while (stmt.step()) gaps.push(rowToQuestion(stmt.get()));
    return { gaps, gapCount: { total, filtered: gaps.length } };
  } finally {
    stmt.free();
  }
}
