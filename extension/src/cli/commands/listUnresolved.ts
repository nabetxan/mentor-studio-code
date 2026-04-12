import { existsSync, readFileSync } from "node:fs";

import { loadSqlJs } from "../../db";
import { narrowLimit, narrowTopicId } from "./narrow";
import {
  QUESTION_SELECT_COLUMNS,
  rowToQuestion,
  type Question,
} from "./questionMapper";
import type { Command } from "./types";

export const listUnresolved: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as { topicId?: unknown; limit?: unknown };
  const limit = narrowLimit(args.limit);
  if (!limit.ok) {
    return { ok: false, error: "invalid_args", detail: limit.error };
  }
  const topicId = narrowTopicId(args.topicId);
  if (!topicId.ok) {
    return { ok: false, error: "invalid_args", detail: topicId.error };
  }

  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const SQL = await loadSqlJs(paths.wasmPath);
  const db = new SQL.Database(readFileSync(paths.dbPath));
  try {
    const totalRes = db.exec(
      "SELECT COUNT(*) FROM questions WHERE isCorrect = 0",
    );
    const total = Number(totalRes[0]?.values[0][0] ?? 0);

    const topicClause = topicId.value !== undefined ? " AND topicId = ?" : "";
    const params: number[] =
      topicId.value !== undefined
        ? [topicId.value, limit.value]
        : [limit.value];
    const sql = `SELECT ${QUESTION_SELECT_COLUMNS} FROM questions WHERE isCorrect = 0${topicClause} ORDER BY lastAnsweredAt ASC, id ASC LIMIT ?`;
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const gaps: Question[] = [];
      while (stmt.step()) gaps.push(rowToQuestion(stmt.get()));
      return { ok: true, gaps, gapCount: { total, filtered: gaps.length } };
    } finally {
      stmt.free();
    }
  } finally {
    db.close();
  }
};
