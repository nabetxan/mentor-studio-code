import type { Locale, PlanStatus, TaskStatus } from "@mentor-studio/shared";
import { createContext } from "react";

export type { Locale };

export interface PlanPanelTranslations {
  planStatus: Record<PlanStatus, string>;
  taskStatus: Record<TaskStatus, string>;
  board: {
    title: string;
    addPlanFromFile: string;
    openPlanFile: string;
    noTasks: string;
  };
  aria: {
    dragHandle: string;
    planNameInput: string;
    taskNameInput: string;
    openPlanFile: string;
  };
}

export const translations: Record<Locale, PlanPanelTranslations> = {
  en: {
    planStatus: {
      active: "Active",
      queued: "Queued",
      paused: "Paused",
      backlog: "Backlog",
      completed: "Completed",
      removed: "Removed",
    },
    taskStatus: {
      active: "Active",
      queued: "Queued",
      completed: "Completed",
      skipped: "Skipped",
    },
    board: {
      title: "Plans",
      addPlanFromFile: "Add Plan from File…",
      openPlanFile: "open",
      noTasks: "No tasks",
    },
    aria: {
      dragHandle: "drag handle",
      planNameInput: "plan name input",
      taskNameInput: "task name input",
      openPlanFile: "open plan file",
    },
  },
  ja: {
    planStatus: {
      active: "進行中",
      queued: "待機",
      paused: "一時停止",
      backlog: "バックログ",
      completed: "完了",
      removed: "削除済み",
    },
    taskStatus: {
      active: "進行中",
      queued: "待機",
      completed: "完了",
      skipped: "スキップ",
    },
    board: {
      title: "プラン",
      addPlanFromFile: "ファイルからプランを追加…",
      openPlanFile: "開く",
      noTasks: "タスクなし",
    },
    aria: {
      dragHandle: "ドラッグハンドル",
      planNameInput: "プラン名入力",
      taskNameInput: "タスク名入力",
      openPlanFile: "プランファイルを開く",
    },
  },
};

export function t(locale: Locale): PlanPanelTranslations {
  return translations[locale] ?? translations.en;
}

export const LocaleContext = createContext<Locale>("en");
