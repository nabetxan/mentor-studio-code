// === Progress data (matches docs/mentor/progress.json) ===

export interface UnresolvedGap {
  concept: string;
  topic: string;
  first_missed: string;
  task: string;
  note: string;
}

export interface ProgressData {
  version: string;
  current_task: string;
  current_step: number | null;
  next_suggest: string;
  resume_context: string;
  completed_tasks: string[];
  skipped_tasks: string[];
  in_progress: string[];
  unresolved_gaps: UnresolvedGap[];
}

// === Question history (matches docs/mentor/question-history.json) ===

export interface QuestionHistoryEntry {
  timestamp: string;
  taskId: string;
  topic: string;
  concept: string;
  question: string;
  userAnswer: string;
  isCorrect: boolean;
}

export interface QuestionHistory {
  history: QuestionHistoryEntry[];
}

// === Project config (matches .mentor-studio.json) ===

export interface TopicConfig {
  key: string;
  label: string;
}

export interface MentorStudioConfig {
  repositoryName: string;
  topics: TopicConfig[];
}

// === Dashboard stats (computed by extension, sent to webview) ===

export interface TopicStats {
  topic: string;
  label: string;
  total: number;
  correct: number;
  rate: number;
}

export interface DashboardData {
  totalQuestions: number;
  correctRate: number;
  byTopic: TopicStats[];
  unresolvedGaps: UnresolvedGap[];
  completedTasks: string[];
  currentTask: string;
}

// === Extension <-> Webview message protocol ===

export type ExtensionMessage =
  | { type: "update"; data: DashboardData }
  | { type: "config"; data: MentorStudioConfig }
  | { type: "noConfig" };

export type WebviewMessage = { type: "copy"; text: string } | { type: "ready" };
