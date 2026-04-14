import type { Database } from "sql.js";
import { ensureTopicId } from "./insertTopics";
import {
  createPlaceholderTask,
  ensureLegacyPlan,
  type LegacyPlanState,
} from "./legacyPlan";
import { safeRun } from "./safeRun";

export interface LegacyQuestion {
  id: string;
  answeredAt: string;
  taskId: string | null;
  topic: string;
  concept: string;
  question: string;
  userAnswer: string;
  isCorrect: boolean;
  reviewOf?: string | null;
}

export interface LegacyGap {
  questionId: string;
  note?: string | null;
}

export interface InsertQuestionsInput {
  history: LegacyQuestion[];
  gaps: LegacyGap[];
  topicMap: Map<string, number>;
  taskMap: Map<string, number>;
  legacyPlanState: LegacyPlanState;
}

function lastInsertRowId(db: Database): number {
  const r = db.exec("SELECT last_insert_rowid()");
  return Number(r[0].values[0][0]);
}

export function insertQuestions(
  db: Database,
  input: InsertQuestionsInput,
  warn: (msg: string) => void = () => {},
): void {
  const oldQidToNewId = new Map<string, number>();
  const roots = input.history.filter((q) => !q.reviewOf);
  const reviews = input.history.filter((q) => !!q.reviewOf);

  const insertStmt = db.prepare(
    `INSERT INTO questions(lastAnsweredAt, taskId, topicId, concept, question, userAnswer, isCorrect, note, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
  );
  try {
    for (const r of roots) {
      const topicId = ensureTopicId(db, input.topicMap, r.topic);
      let taskId: number | null = null;
      if (r.taskId !== null && r.taskId !== undefined) {
        const mapped = input.taskMap.get(r.taskId);
        if (mapped !== undefined) {
          taskId = mapped;
        } else {
          const legacyPlanId = ensureLegacyPlan(db, input.legacyPlanState);
          taskId = createPlaceholderTask(db, legacyPlanId, r.taskId);
          input.taskMap.set(r.taskId, taskId);
        }
      }
      safeRun(insertStmt, "insertQuestions.root", r.id, [
        r.answeredAt,
        taskId,
        topicId,
        r.concept,
        r.question,
        r.userAnswer,
        r.isCorrect ? 1 : 0,
      ]);
      oldQidToNewId.set(r.id, lastInsertRowId(db));
    }
  } finally {
    insertStmt.free();
  }

  const updStmt = db.prepare(
    "UPDATE questions SET userAnswer=?, isCorrect=?, lastAnsweredAt=?, attempts=attempts+1 WHERE id=?",
  );
  try {
    const sortedReviews = [...reviews].sort((a, b) =>
      a.answeredAt.localeCompare(b.answeredAt),
    );
    for (const rv of sortedReviews) {
      if (rv.reviewOf === rv.id) {
        warn(`self-reviewOf id=${rv.id}`);
        continue;
      }
      const rootNewId = oldQidToNewId.get(rv.reviewOf as string);
      if (rootNewId === undefined) {
        warn(`reviewOf points to missing root ${rv.reviewOf}`);
        continue;
      }
      safeRun(updStmt, "insertQuestions.review", rv.id, [
        rv.userAnswer,
        rv.isCorrect ? 1 : 0,
        rv.answeredAt,
        rootNewId,
      ]);
    }
  } finally {
    updStmt.free();
  }

  const noteStmt = db.prepare(
    "UPDATE questions SET isCorrect=0, note=? WHERE id=?",
  );
  try {
    for (const g of input.gaps) {
      const newId = oldQidToNewId.get(g.questionId);
      if (newId === undefined) {
        warn(`gap refers to missing question ${g.questionId}`);
        continue;
      }
      safeRun(noteStmt, "insertQuestions.gap", g.questionId, [
        g.note ?? null,
        newId,
      ]);
    }
  } finally {
    noteStmt.free();
  }
}
