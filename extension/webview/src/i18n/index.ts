import type { Locale } from "@mentor-studio/shared";
import type { TranslationKey } from "./translations";
import { translations } from "./translations";

export type { TranslationKey };

export function t(key: TranslationKey, locale: Locale): string {
  return translations[key][locale];
}
