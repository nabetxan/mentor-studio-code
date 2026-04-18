import { withWriteTransaction } from "../../../db";
import type { CliPaths } from "../../context";
import type { CommandResult } from "../types";

export async function updateQuestion(
  args: Record<string, unknown>,
  paths: CliPaths,
): Promise<CommandResult> {
  if (!Number.isInteger(args.id)) {
    return { ok: false, error: "invalid_args", detail: "id must be integer" };
  }
  if (typeof args.userAnswer !== "string") {
    return {
      ok: false,
      error: "invalid_args",
      detail: "userAnswer must be string",
    };
  }
  if (typeof args.isCorrect !== "boolean") {
    return {
      ok: false,
      error: "invalid_args",
      detail: "isCorrect must be boolean",
    };
  }

  const id = args.id as number;
  const userAnswer = args.userAnswer;
  const isCorrect = args.isCorrect;
  const note =
    isCorrect === true
      ? null
      : typeof args.note === "string"
        ? args.note
        : null;
  const lastAnsweredAt = new Date().toISOString();

  return withWriteTransaction(
    paths.dbPath,
    { purpose: "normal" },
    (db) => {
      const findStmt = db.prepare("SELECT 1 FROM questions WHERE id = ?");
      let found = false;
      try {
        findStmt.bind([id]);
        found = findStmt.step();
      } finally {
        findStmt.free();
      }
      if (!found) return { ok: false, error: "not_found" };

      const upd = db.prepare(
        `UPDATE questions SET userAnswer=?, isCorrect=?, note=?, lastAnsweredAt=?, attempts=attempts+1 WHERE id=?`,
      );
      try {
        upd.run([userAnswer, isCorrect ? 1 : 0, note, lastAnsweredAt, id]);
      } finally {
        upd.free();
      }

      const q = db.prepare("SELECT attempts FROM questions WHERE id = ?");
      let attempts = 0;
      try {
        q.bind([id]);
        if (q.step()) attempts = Number(q.get()[0]);
      } finally {
        q.free();
      }
      return { ok: true, id, attempts };
    },
  );
}
