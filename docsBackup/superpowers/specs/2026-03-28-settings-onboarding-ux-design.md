# Settings Onboarding UX — Design Spec

**Date:** 2026-03-28
**Branch:** enhance-skill

## Problem

New users who install the extension and open the Dashboard see the Settings tab but have no visual cue that:

1. A required implementation plan has not been set
2. Their learner profile has not been registered

This leads to confusion about what to do first.

## Goals

- Surface missing setup state via a red `!` badge on the Settings tab
- Highlight the unset implementation plan with a reddish border
- Add a Profile registration/update button above the language toggle with a prompt-copy flow matching Actions UX

---

## Data Flow

### 1. `packages/shared/src/types.ts`

Add `learner_profile` as an optional field to `ProgressData`, and add `profileLastUpdated` to `DashboardData`:

```ts
// Only `last_updated` is needed by the extension UI at this time.
// Other learner_profile fields (experience, level, etc.) are written by the AI
// and read directly from progress.json by the mentor AI — they do not flow through
// the extension data pipeline. Expand this interface only when the UI needs them.
export interface LearnerProfile {
  last_updated?: string | null;
}

export interface ProgressData {
  // ...existing fields unchanged...
  learner_profile?: LearnerProfile;
}

export interface DashboardData {
  // ...existing fields unchanged...
  profileLastUpdated: string | null;
}
```

### 2. `extension/src/services/dataParser.ts`

**In `parseProgressData`:** Parse `learner_profile` from the raw `obj`. Since `learner_profile` fields are optional and only `last_updated` is needed downstream, parse leniently:

```ts
const learnerProfile =
  typeof obj.learner_profile === "object" && obj.learner_profile !== null
    ? {
        last_updated:
          typeof (obj.learner_profile as Record<string, unknown>).last_updated === "string"
            ? ((obj.learner_profile as Record<string, unknown>).last_updated as string)
            : null,
      }
    : undefined;

return {
  // ...existing fields...
  learner_profile: learnerProfile,
};
```

**In `computeDashboardData`:** Read from the already-parsed typed struct:

```ts
return {
  // ...existing fields...
  profileLastUpdated: progress.learner_profile?.last_updated ?? null,
};
```

### 3. `App.tsx`

Compute `settingsHasWarning` **directly in `App.tsx`** from `data` and `config` — do NOT delegate to a Settings callback. This avoids stale badge state when the Settings tab is not mounted.

```ts
const settingsHasWarning =
  !config?.mentorFiles?.plan ||
  !data?.profileLastUpdated;
```

- Initial value: `true` by default (both `config` and `data` start as `null`, so `!null?.mentorFiles?.plan` is `true`)
- Recomputes reactively whenever `config` or `data` changes
- No `onWarningChange` prop needed on `Settings`

Render badge on the Settings tab button:

```tsx
<button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
  <span className="tab-btn-inner">
    <SettingsIcon />
    <span>{t("app.tab.settings", locale)}</span>
    {settingsHasWarning && <span className="tab-badge">!</span>}
  </span>
</button>
```

Pass `profileLastUpdated` to `Settings`:

```tsx
{tab === "settings" && (
  <Settings
    config={config}
    locale={locale}
    onLocaleChange={handleLocaleChange}
    profileLastUpdated={data?.profileLastUpdated ?? null}
  />
)}
```

### 4. `Settings.tsx`

**Updated `SettingsProps`:**

```ts
interface SettingsProps {
  config: MentorStudioConfig | null;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  profileLastUpdated: string | null;
}
```

**Updated `FileSettingProps`:** Add optional `warning` prop:

```ts
interface FileSettingProps {
  label: string;
  field: FileField;
  value: string | null;
  createPrompt: string;
  locale: Locale;
  warning?: boolean;
}
```

In `FileSetting`, apply `setting-item--warning` when `warning` is true:

```tsx
<div className={`setting-item${warning ? " setting-item--warning" : ""}`}>
```

Pass `warning` to the plan FileSetting:

```tsx
<FileSetting
  label={t("settings.plan", locale)}
  field="plan"
  value={mentorFiles.plan}
  createPrompt={t("settings.prompt.plan", locale)}
  locale={locale}
  warning={!mentorFiles.plan}
/>
```

**New `ProfileSection` component** (defined in `Settings.tsx`):

```ts
interface ProfileSectionProps {
  profileLastUpdated: string | null;
  locale: Locale;
}
```

Layout: `setting-item` with `setting-item--warning` when `!profileLastUpdated`. Contains a single `snippet-btn` button (same class as Actions) and a description text below it.

No `setting-label` element — the button text itself serves as the label.

Layout (top to bottom inside the `setting-item` div):
1. A `snippet-btn` button (same class as Actions):
   - Left: `t("settings.profile.register", locale)` or `t("settings.profile.update", locale)` based on `profileLastUpdated`
   - Right: `<CopyIcon />` normally, `<CheckIcon /> + t("actions.copied", locale)` for 2s after click
   - On click: `postMessage({ type: "copy", text: t("settings.prompt.intake", locale) })`
2. A `<p className="actions-description">` below the button: reuses `t("actions.description", locale)` key
   - `.actions-description` is defined at top-level in `main.css` (not nested under `.actions`), so it is safe to reuse here

**Copy state management:** `ProfileSection` manages its own copied state using `useState<boolean>` and `useRef<ReturnType<typeof setTimeout> | null>`, following the same pattern as `FileSetting` — including a `useEffect` cleanup to clear the timer on unmount.

Placement in `Settings` render: rendered as the **first** item, before the plan `FileSetting`.

**Known trade-off:** `settingsHasWarning` in `App.tsx` starts as `true` (both `config` and `data` are initially `null`), which means users with everything set will briefly see the `!` badge on load. This is acceptable given the narrow time window and the alternative (defaulting to `false`) would hide the badge entirely for users who never visit Settings.

---

## Translations

New keys added to `translations.ts`:

| Key | ja | en |
|-----|----|----|
| `settings.profile.register` | プロフィール登録 | Register Profile |
| `settings.profile.update` | プロフィール更新 | Update Profile |
| `settings.prompt.intake` | `docs/mentor/skills/intake/SKILL.md を読んで、インテークフローを実行してください。` | `Read docs/mentor/skills/intake/SKILL.md and run the intake flow.` |

Reused existing keys (no new keys needed):
- Button post-click label: `"actions.copied"` (already translated)
- Description text: `"actions.description"` (already translated)

---

## CSS Changes (`main.css`)

```css
/* Wrapper for tab button content to allow badge positioning */
.tab-btn-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

/* Red badge on Settings tab */
.tab-badge {
  position: absolute;
  top: -4px;
  right: -6px;
  background: var(--vscode-editorError-foreground, #f48771);
  color: #fff;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  font-size: 0.7rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* Warning border for setting items (plan unset, profile unset) */
.setting-item--warning {
  border: 1px solid rgba(255, 100, 100, 0.45);
}
```

Note: The existing `.tabs button` style uses `display: flex; flex-direction: column; align-items: center; gap: 2px` inline on the button itself. To support the badge's `position: absolute`, wrap the button's children in `.tab-btn-inner` (a relative-positioned span) instead of relying on the button as the positioning context.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add `LearnerProfile` interface, `learner_profile?` to `ProgressData`, `profileLastUpdated` to `DashboardData` |
| `extension/src/services/dataParser.ts` | Parse `learner_profile.last_updated` in `parseProgressData`; include `profileLastUpdated` in `computeDashboardData` return |
| `extension/webview/src/App.tsx` | Compute `settingsHasWarning` from `data`/`config`; add badge to Settings tab; pass `profileLastUpdated` to Settings |
| `extension/webview/src/components/Settings.tsx` | Add `profileLastUpdated` prop, `warning` prop to `FileSetting`, new `ProfileSection` component |
| `extension/webview/src/i18n/translations.ts` | Add 3 new translation keys |
| `extension/webview/src/styles/main.css` | Add `.tab-btn-inner`, `.tab-badge`, `.setting-item--warning` |

---

## Out of Scope

- Changing the Overview or Actions tabs
- Modifying how `learner_profile` is written (handled by AI/SKILL.md)
- Validating profile content fields beyond `last_updated`
- Persisting `settingsHasWarning` across extension reloads (computed from live data)
