# Current Task

## Phase 2.3 — Task 1: Add Locale type and config fields to shared types

**Plan:** `docs/superpowers/plans/2026-03-24-phase2.3-i18n-and-actions-ui.md`

**Goal:** `Locale` 型を shared types に追加し、`MentorStudioConfig` に `locale` フィールド、`WebviewMessage` に `setLocale` メッセージを追加する。

**Files:**
- Modify: `packages/shared/src/types.ts`

**Steps:**
1. `Locale` 型 (`"ja" | "en"`) を追加
2. `MentorStudioConfig` に `locale?: Locale` を追加
3. `WebviewMessage` に `{ type: "setLocale"; locale: Locale }` を追加
4. ビルド確認
5. コミット
