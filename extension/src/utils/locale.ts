import type { Locale } from "@mentor-studio/shared";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as vscode from "vscode";

/**
 * VS Code UI language → `Locale`. Used as fallback when `.mentor/config.json`
 * is missing or has no `locale` field.
 */
export function detectSystemLocale(): Locale {
  return vscode.env.language.startsWith("ja") ? "ja" : "en";
}

/**
 * Resolve the active locale: prefer `.mentor/config.json`'s `locale` field;
 * fall back to the system locale when the file is missing, malformed, or
 * lacks a valid locale value. Never throws.
 */
export async function resolveLocale(workspaceRoot: string): Promise<Locale> {
  try {
    const raw = await readFile(
      join(workspaceRoot, ".mentor", "config.json"),
      "utf-8",
    );
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (obj.locale === "ja" || obj.locale === "en") return obj.locale;
  } catch {
    // fall through to system locale
  }
  return detectSystemLocale();
}
