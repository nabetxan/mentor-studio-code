import type { Locale } from "@mentor-studio/shared";
import type { TranslationKey } from "./translations";
import { translations } from "./translations";

export type { TranslationKey };

export function t(key: TranslationKey, locale: Locale): string {
  return translations[key][locale];
}

export const deleteTopicErrorKeys: ReadonlySet<string> = new Set([
  "has_related_data",
  "topic_not_found",
  "config_not_loaded",
  "delete_failed",
  "read_history_failed",
  "read_progress_failed",
]);
