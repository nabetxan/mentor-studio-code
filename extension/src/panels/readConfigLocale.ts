import type { Locale } from "@mentor-studio/shared";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readConfigLocale(workspaceRoot: string): Promise<Locale> {
  try {
    const raw = await readFile(
      join(workspaceRoot, ".mentor", "config.json"),
      "utf-8",
    );
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (obj.locale === "ja" || obj.locale === "en") return obj.locale;
    return "en";
  } catch {
    return "en";
  }
}
