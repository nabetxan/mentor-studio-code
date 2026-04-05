// === Progress data (matches .mentor/progress.json) ===

export interface UnresolvedGap {
  questionId: string;
  concept: string;
  topic: string;
  last_missed: string;
  task: string;
  note: string;
}

export interface CompletedTask {
  task: string;
  name: string;
  plan: string;
}

export interface SkippedTask {
  task: string;
  plan: string;
}

export interface LearnerProfile {
  last_updated?: string | null;
}

export interface ProgressData {
  version: string;
  current_plan: string | null;
  current_task: string | null;
  current_step: string | number | null;
  next_suggest: string | null;
  resume_context: string | null;
  completed_tasks: CompletedTask[];
  skipped_tasks: SkippedTask[];
  unresolved_gaps: UnresolvedGap[];
  learner_profile?: LearnerProfile;
}

// === Question history (matches .mentor/question-history.json) ===

export interface QuestionHistoryEntry {
  id: string;
  reviewOf: string | null;
  answeredAt: string;
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

// === Project config (matches .mentor/config.json) ===

export interface TopicConfig {
  key: string;
  label: string;
}

export interface MentorFiles {
  spec: string | null;
  plan: string | null;
}

export interface MentorStudioConfig {
  repositoryName: string;
  workspacePath?: string;
  topics: TopicConfig[];
  mentorFiles?: MentorFiles;
  locale?: Locale;
  enableMentor?: boolean;
  extensionVersion?: string;
  extensionUninstalled?: boolean;
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
  completedTasks: CompletedTask[];
  currentTask: string | null;
  profileLastUpdated: string | null;
  topicsWithHistory: string[];
}

// === Extension <-> Webview message protocol ===

export type DeleteTopicResultEntry = {
  key: string;
  ok: boolean;
  error?: string;
};

export type ExtensionMessage =
  | { type: "update"; data: DashboardData }
  | { type: "config"; data: MentorStudioConfig }
  | { type: "noConfig"; locale?: Locale }
  | { type: "addTopicResult"; ok: boolean; key?: string; error?: string }
  | { type: "deleteTopicsResult"; results: DeleteTopicResultEntry[] };

export type FileField = "spec" | "plan";

export type Locale = "ja" | "en";

export type WebviewMessage =
  | { type: "copy"; text: string }
  | { type: "ready" }
  | { type: "runSetup" }
  | { type: "selectFile"; field: FileField }
  | { type: "clearFile"; field: FileField }
  | { type: "setLocale"; locale: Locale }
  | { type: "setEnableMentor"; value: boolean }
  | { type: "mergeTopic"; fromKey: string; toKey: string }
  | { type: "updateTopicLabel"; key: string; newLabel: string }
  | { type: "addTopic"; label: string }
  | { type: "deleteTopics"; keys: string[] }
  | { type: "openFile"; relativePath: string }
  | { type: "removeMentor" };
