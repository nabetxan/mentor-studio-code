import type {
  DashboardData,
  ProgressData,
  QuestionHistory,
  TopicConfig,
  TopicStats,
} from "@mentor-studio/shared";

export function parseProgressData(raw: string): ProgressData | null {
  try {
    const data = JSON.parse(raw);
    if (
      typeof data.version !== "string" ||
      typeof data.current_task !== "string" ||
      !Array.isArray(data.completed_tasks)
    ) {
      return null;
    }
    return data as ProgressData;
  } catch {
    return null;
  }
}

export function parseQuestionHistory(raw: string): QuestionHistory {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.history)) {
      return { history: [] };
    }
    return data as QuestionHistory;
  } catch {
    return { history: [] };
  }
}

export function computeDashboardData(
  progress: ProgressData,
  history: QuestionHistory,
  topics: TopicConfig[],
): DashboardData {
  const entries = history.history;
  const totalQuestions = entries.length;
  const correctCount = entries.filter((e) => e.isCorrect).length;
  const correctRate = totalQuestions > 0 ? correctCount / totalQuestions : 0;

  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const entry of entries) {
    const existing = topicMap.get(entry.topic) ?? { correct: 0, total: 0 };
    existing.total += 1;
    if (entry.isCorrect) {
      existing.correct += 1;
    }
    topicMap.set(entry.topic, existing);
  }

  const byTopic: TopicStats[] = [];
  for (const [topicKey, stats] of topicMap) {
    const config = topics.find((t) => t.key === topicKey);
    byTopic.push({
      topic: topicKey,
      label: config?.label ?? topicKey,
      total: stats.total,
      correct: stats.correct,
      rate: stats.total > 0 ? stats.correct / stats.total : 0,
    });
  }

  byTopic.sort((a, b) => a.rate - b.rate);

  return {
    totalQuestions,
    correctRate,
    byTopic,
    unresolvedGaps: progress.unresolved_gaps,
    completedTasks: progress.completed_tasks,
    currentTask: progress.current_task,
  };
}
