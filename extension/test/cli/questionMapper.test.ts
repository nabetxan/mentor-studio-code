import { describe, expect, it } from "vitest";

import {
  QUESTION_SELECT_COLUMNS,
  rowToQuestion,
} from "../../src/cli/commands/questionMapper";

describe("rowToQuestion", () => {
  it("maps integer isCorrect to boolean and null note/taskId to null", () => {
    const row = [1, null, 2, "c", "q", "a", 0, null, 1, "2026-04-12T00:00:00Z"];
    expect(rowToQuestion(row)).toEqual({
      id: 1,
      taskId: null,
      topicId: 2,
      concept: "c",
      question: "q",
      userAnswer: "a",
      isCorrect: false,
      note: null,
      attempts: 1,
      lastAnsweredAt: "2026-04-12T00:00:00Z",
    });
  });

  it("maps isCorrect=1 to true and populated note/taskId to values", () => {
    const row = [
      9,
      3,
      5,
      "concept",
      "question",
      "answer",
      1,
      "reviewer note",
      2,
      "2026-04-12T10:00:00Z",
    ];
    expect(rowToQuestion(row)).toEqual({
      id: 9,
      taskId: 3,
      topicId: 5,
      concept: "concept",
      question: "question",
      userAnswer: "answer",
      isCorrect: true,
      note: "reviewer note",
      attempts: 2,
      lastAnsweredAt: "2026-04-12T10:00:00Z",
    });
  });

  it("QUESTION_SELECT_COLUMNS matches rowToQuestion order", () => {
    expect(QUESTION_SELECT_COLUMNS).toBe(
      "id, taskId, topicId, concept, question, userAnswer, isCorrect, note, attempts, lastAnsweredAt",
    );
  });
});
