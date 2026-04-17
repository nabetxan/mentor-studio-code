import { InvariantViolationError, withWriteTransaction } from "../../../db";
import type { CliPaths } from "../../context";
import type { CommandResult } from "../types";

export async function insertQuestion(
  args: Record<string, unknown>,
  paths: CliPaths,
): Promise<CommandResult> {
  const required = [
    "taskId",
    "topicId",
    "concept",
    "question",
    "userAnswer",
    "isCorrect",
  ] as const;
  for (const k of required) {
    if (!(k in args)) {
      return { ok: false, error: "invalid_args", detail: `missing ${k}` };
    }
  }
  const taskId = args.taskId;
  if (taskId !== null && !Number.isInteger(taskId)) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "taskId must be integer|null",
    };
  }
  if (!Number.isInteger(args.topicId)) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "topicId must be integer",
    };
  }
  if (
    typeof args.concept !== "string" ||
    typeof args.question !== "string" ||
    typeof args.userAnswer !== "string"
  ) {
    return {
      ok: false,
      error: "invalid_args",
      detail: "concept/question/userAnswer must be strings",
    };
  }
  if (typeof args.isCorrect !== "boolean") {
    return {
      ok: false,
      error: "invalid_args",
      detail: "isCorrect must be boolean",
    };
  }

  const topicId = args.topicId as number;
  const taskIdValue = taskId as number | null;
  const concept = args.concept;
  const question = args.question;
  const userAnswer = args.userAnswer;
  const isCorrect = args.isCorrect;
  const note =
    args.isCorrect === true
      ? null
      : typeof args.note === "string"
        ? args.note
        : null;
  const lastAnsweredAt = new Date().toISOString();

  try {
    const id = await withWriteTransaction(
      paths.dbPath,
      { wasmPath: paths.wasmPath, purpose: "normal" },
      (db) => {
        if (taskIdValue !== null) {
          const chk = db.prepare("SELECT 1 FROM tasks WHERE id = ?");
          let exists = false;
          try {
            chk.bind([taskIdValue]);
            exists = chk.step();
          } finally {
            chk.free();
          }
          if (!exists) {
            throw new InvariantViolationError(
              "invalid_taskId",
              `task ${taskIdValue} not found`,
            );
          }
        }
        {
          const chk = db.prepare("SELECT 1 FROM topics WHERE id = ?");
          let exists = false;
          try {
            chk.bind([topicId]);
            exists = chk.step();
          } finally {
            chk.free();
          }
          if (!exists) {
            throw new InvariantViolationError(
              "invalid_topicId",
              `topic ${topicId} not found`,
            );
          }
        }

        const stmt = db.prepare(
          `INSERT INTO questions(lastAnsweredAt, taskId, topicId, concept, question, userAnswer, isCorrect, note, attempts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        );
        try {
          stmt.run([
            lastAnsweredAt,
            taskIdValue,
            topicId,
            concept,
            question,
            userAnswer,
            isCorrect ? 1 : 0,
            note,
          ]);
        } finally {
          stmt.free();
        }
        const r = db.exec("SELECT last_insert_rowid()");
        return Number(r[0].values[0][0]);
      },
    );
    return { ok: true, id, attempts: 1 };
  } catch (e) {
    if (e instanceof InvariantViolationError) {
      if (e.code === "invalid_taskId") {
        return { ok: false, error: "invalid_taskId" };
      }
      if (e.code === "invalid_topicId") {
        return { ok: false, error: "invalid_topicId" };
      }
    }
    throw e;
  }
}
