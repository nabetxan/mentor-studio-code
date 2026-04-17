export const QUESTION_SELECT_COLUMNS =
  "id, taskId, topicId, concept, question, userAnswer, isCorrect, note, attempts, lastAnsweredAt";

export interface Question {
  id: number;
  taskId: number | null;
  topicId: number;
  concept: string;
  question: string;
  userAnswer: string;
  isCorrect: boolean;
  note: string | null;
  attempts: number;
  lastAnsweredAt: string;
}

export function rowToQuestion(row: unknown[]): Question {
  const [
    id,
    taskId,
    topicId,
    concept,
    question,
    userAnswer,
    isCorrect,
    note,
    attempts,
    lastAnsweredAt,
  ] = row;
  return {
    id: Number(id),
    taskId: taskId == null ? null : Number(taskId),
    topicId: Number(topicId),
    concept: String(concept),
    question: String(question),
    userAnswer: String(userAnswer),
    isCorrect: Number(isCorrect) === 1,
    note: note == null ? null : String(note),
    attempts: Number(attempts),
    lastAnsweredAt: String(lastAnsweredAt),
  };
}
