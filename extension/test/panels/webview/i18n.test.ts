import type { Locale } from "@mentor-studio/shared";
import { describe, expect, it } from "vitest";
import { t, translations } from "../../../src/panels/webview/i18n";

describe("i18n translations", () => {
  it("en has all 6 status labels", () => {
    const tr = translations.en;
    expect(tr.planStatus.active).toBe("Active");
    expect(tr.planStatus.queued).toBe("Queued");
    expect(tr.planStatus.paused).toBe("Paused");
    expect(tr.planStatus.backlog).toBe("Backlog");
    expect(tr.planStatus.completed).toBe("Completed");
    expect(tr.planStatus.removed).toBe("Removed");
  });

  it("ja has all 6 status labels", () => {
    const tr = translations.ja;
    expect(tr.planStatus.active).toBe("進行中");
    expect(tr.planStatus.queued).toBe("待機");
    expect(tr.planStatus.paused).toBe("一時停止");
    expect(tr.planStatus.backlog).toBe("バックログ");
    expect(tr.planStatus.completed).toBe("完了");
    expect(tr.planStatus.removed).toBe("削除済み");
  });

  it("StatusMenu display order matches the 6 status keys", () => {
    const order = [
      "active",
      "queued",
      "paused",
      "backlog",
      "completed",
      "removed",
    ] as const;
    for (const locale of ["en", "ja"] as Locale[]) {
      const keys = Object.keys(translations[locale].planStatus);
      expect(keys).toEqual(order);
    }
  });

  it("board strings exist in en and ja", () => {
    expect(translations.en.board.title).toBe("Plans");
    expect(translations.ja.board.title).toBe("プラン");
    expect(translations.en.board.addPlanFromFile).toContain("Add Plan");
    expect(translations.ja.board.addPlanFromFile).toContain("プラン");
    expect(translations.en.board.openPlanFile).toBe("open");
    expect(translations.ja.board.openPlanFile).toBe("開く");
  });

  it("aria labels exist in en and ja", () => {
    expect(translations.en.aria.dragHandle).toBe("drag handle");
    expect(translations.ja.aria.dragHandle).toBe("ドラッグハンドル");
    expect(translations.en.aria.openPlanFile).toBe("open plan file");
    expect(translations.ja.aria.openPlanFile).toBe("プランファイルを開く");
  });

  it("t() falls back to en for unknown locale", () => {
    const result = t("fr" as Locale);
    expect(result.planStatus.active).toBe("Active");
    expect(result.board.title).toBe("Plans");
  });
});
