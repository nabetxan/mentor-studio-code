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
  experience: string;
  level: string;
  interests: string[];
  weak_areas: string[];
  mentor_style: string;
  last_updated: string | null;
}

// === Project config (matches .mentor/config.json) ===

export interface TopicConfig {
  key: string;
  label: string;
}

export interface MentorFiles {
  spec: string | null;
}

export interface MentorStudioConfig {
  repositoryName: string;
  workspacePath?: string;
  mentorFiles?: MentorFiles;
  locale?: Locale;
  enableMentor?: boolean;
  extensionVersion?: string;
  extensionUninstalled?: boolean;
}

export type ClaudeMdScope = "project" | "personal";

export interface MentorEntrypointFileStatus {
  claudeMdEnabled: boolean;
  claudeMdScope: ClaudeMdScope | null;
  projectClaudeMd: boolean;
  personalClaudeMd: boolean;
  agentsMdEnabled: boolean;
  hasEntrypointFile: boolean;
}

// === Dashboard stats (computed by extension, sent to webview) ===

export interface TopicStats {
  topic: string;
  label: string;
  total: number;
  correct: number;
  rate: number;
}

export type PlanStatus =
  | "queued"
  | "active"
  | "paused"
  | "completed"
  | "backlog"
  | "removed";

export interface PlanDto {
  id: number;
  name: string;
  filePath: string | null;
  status: PlanStatus;
  sortOrder: number;
}

export type TaskStatus = "queued" | "active" | "completed" | "skipped";

export interface TaskDto {
  id: number;
  planId: number;
  name: string;
  status: TaskStatus;
  sortOrder: number;
}

export interface TopicDto {
  key: string;
  label: string;
}

export interface DashboardData {
  totalQuestions: number;
  correctRate: number;
  byTopic: TopicStats[];
  allTopics: TopicConfig[];
  unresolvedGaps: UnresolvedGap[];
  completedTasks: CompletedTask[];
  currentTask: string | null;
  profileLastUpdated: string | null;
  topicsWithHistory: string[];
  plans: PlanDto[];
  activePlan: PlanDto | null;
  nextPlan: PlanDto | null;
}

// === Extension <-> Webview message protocol ===

export type DeleteTopicResultEntry = {
  key: string;
  ok: boolean;
  error?: string;
};

export interface CleanupOptions {
  mentorFolder: boolean;
  profile: boolean;
  entrypointFiles: boolean;
  wipeExternalDb: boolean;
}

export type ExtensionMessage =
  | { type: "update"; data: DashboardData }
  | {
      type: "config";
      data: MentorStudioConfig;
      entrypointStatus?: MentorEntrypointFileStatus;
      /** Runtime DB location info — populated once Setup has run (workspaceId known). */
      dataLocation?: {
        dbPath: string; // /Users/.../MentorStudioCode/<uuid>/data.db
        dirPath: string; // parent directory (what we open in Finder)
      };
    }
  | { type: "noConfig"; locale?: Locale }
  | { type: "needsMigration"; locale?: Locale }
  | { type: "addTopicResult"; ok: boolean; key?: string; error?: string }
  | { type: "deleteTopicsResult"; results: DeleteTopicResultEntry[] }
  | { type: "activatePlanResult"; id: number; ok: boolean; error?: string }
  | { type: "deactivatePlanResult"; id: number; ok: boolean; error?: string }
  | { type: "pauseActivePlanResult"; id: number; ok: boolean; error?: string }
  | {
      type: "changeActivePlanFileResult";
      ok: boolean;
      error?: string;
    };

export type FileField = "spec" | "plan";

export type Locale = "ja" | "en";

export type WebviewMessage =
  | { type: "copy"; text: string }
  | { type: "ready" }
  | {
      type: "runSetup";
      source?: "sidebarNoConfig" | "sidebarMigration" | "settingsManual";
    }
  | { type: "selectFile"; field: FileField }
  | { type: "clearFile"; field: FileField }
  | { type: "setLocale"; locale: Locale }
  | { type: "setEnableMentor"; value: boolean }
  | { type: "setClaudeMdEnabled"; value: boolean }
  | { type: "setClaudeMdScope"; value: ClaudeMdScope }
  | { type: "setAgentsMdEnabled"; value: boolean }
  | { type: "mergeTopic"; fromKey: string; toKey: string }
  | { type: "updateTopicLabel"; key: string; newLabel: string }
  | { type: "addTopic"; label: string }
  | { type: "deleteTopics"; keys: string[] }
  | { type: "openFile"; relativePath: string }
  | { type: "cleanupMentor"; options: CleanupOptions }
  | { type: "activatePlan"; id: number }
  | { type: "deactivatePlan"; id: number }
  | { type: "openPlanPanel" }
  | { type: "pauseActivePlan"; id: number }
  | { type: "changeActivePlanFile" }
  | { type: "openDataLocation"; path: string }
  | { type: "exportData" }
  | { type: "openExtensionsView" };
