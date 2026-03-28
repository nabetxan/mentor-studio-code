import type {
  DashboardData,
  ProgressData,
  QuestionHistory,
  QuestionHistoryEntry,
  TopicConfig,
  TopicStats,
  UnresolvedGap,
} from "@mentor-studio/shared";

export function parseProgressData(raw: string): ProgressData | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) {
      return null;
    }
    const obj = data as Record<string, unknown>;
    if (
      typeof obj.version !== "string" ||
      (obj.current_task !== null && typeof obj.current_task !== "string") ||
      !Array.isArray(obj.completed_tasks)
    ) {
      return null;
    }
    const completedTasks = (obj.completed_tasks as unknown[]).filter(
      (item): item is { task: string; name: string; plan: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).task === "string" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        typeof (item as Record<string, unknown>).plan === "string",
    );
    return {
      version: obj.version,
      current_plan:
        typeof obj.current_plan === "string" ? obj.current_plan : null,
      current_task:
        typeof obj.current_task === "string" ? obj.current_task : null,
      current_step:
        typeof obj.current_step === "number" ? obj.current_step : null,
      next_suggest:
        typeof obj.next_suggest === "string" ? obj.next_suggest : null,
      resume_context:
        typeof obj.resume_context === "string" ? obj.resume_context : null,
      completed_tasks: completedTasks,
      skipped_tasks: Array.isArray(obj.skipped_tasks)
        ? (obj.skipped_tasks as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
      in_progress: Array.isArray(obj.in_progress)
        ? (obj.in_progress as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
      unresolved_gaps: Array.isArray(obj.unresolved_gaps)
        ? (obj.unresolved_gaps as unknown[]).filter(
            (item): item is UnresolvedGap =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as Record<string, unknown>).concept === "string" &&
              typeof (item as Record<string, unknown>).topic === "string" &&
              typeof (item as Record<string, unknown>).first_missed ===
                "string" &&
              typeof (item as Record<string, unknown>).task === "string" &&
              typeof (item as Record<string, unknown>).note === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

export function parseQuestionHistory(raw: string): QuestionHistory {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) {
      return { history: [] };
    }
    const obj = data as Record<string, unknown>;
    if (!Array.isArray(obj.history)) {
      return { history: [] };
    }
    const history = obj.history.filter(
      (entry): entry is QuestionHistoryEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).topic === "string" &&
        typeof (entry as Record<string, unknown>).isCorrect === "boolean",
    );
    return { history };
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
