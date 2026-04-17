import type { Locale, PlanStatus } from "@mentor-studio/shared";
import { createContext } from "react";

export type { Locale };

export interface PlanPanelTranslations {
  planStatus: Record<PlanStatus, string>;
  board: {
    title: string;
    addPlanFromFile: string;
    openPlanFile: string;
  };
  aria: {
    dragHandle: string;
    planNameInput: string;
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
    board: {
      title: "Plans",
      addPlanFromFile: "Add Plan from File…",
      openPlanFile: "open",
    },
    aria: {
      dragHandle: "drag handle",
      planNameInput: "plan name input",
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
    board: {
      title: "プラン",
      addPlanFromFile: "ファイルからプランを追加…",
      openPlanFile: "開く",
    },
    aria: {
      dragHandle: "ドラッグハンドル",
      planNameInput: "プラン名入力",
      openPlanFile: "プランファイルを開く",
    },
  },
};

export function t(locale: Locale): PlanPanelTranslations {
  return translations[locale] ?? translations.en;
}

export const LocaleContext = createContext<Locale>("en");
