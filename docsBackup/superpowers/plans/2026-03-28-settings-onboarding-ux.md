# Settings Onboarding UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface missing setup state (no plan set, no learner profile) via a red `!` badge on the Settings tab, a warning border on the plan setting item, and a new Profile registration button.

**Architecture:** Add `learner_profile` to shared types and parse it in `dataParser.ts`; compute `settingsHasWarning` reactively in `App.tsx` from `data`/`config`; extend `Settings.tsx` with a `ProfileSection` component and a `warning` prop on `FileSetting`.

**Tech Stack:** TypeScript, React (webview), Vitest (tests), VSCode Extension API

---

## Chunk 1: Types, DataParser, Translations, CSS

### Task 1: Add shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add `LearnerProfile` interface and update `ProgressData` and `DashboardData`**

  In `packages/shared/src/types.ts`, add after the `UnresolvedGap` / `CompletedTask` interfaces and update the two existing interfaces:

  ```ts
  // Add before ProgressData:
  export interface LearnerProfile {
    last_updated?: string | null;
  }
  ```

  Add optional field to `ProgressData`:
  ```ts
  export interface ProgressData {
    version: string;
    current_plan: string | null;
    current_task: string | null;
    current_step: number | null;
    next_suggest: string | null;
    resume_context: string | null;
    completed_tasks: CompletedTask[];
    skipped_tasks: string[];
    unresolved_gaps: UnresolvedGap[];
    learner_profile?: LearnerProfile;   // ← add this line
  }
  ```

  Add field to `DashboardData`:
  ```ts
  export interface DashboardData {
    totalQuestions: number;
    correctRate: number;
    byTopic: TopicStats[];
    unresolvedGaps: UnresolvedGap[];
    completedTasks: CompletedTask[];
    currentTask: string | null;
    profileLastUpdated: string | null;  // ← add this line
  }
  ```

---

### Task 2: Parse `learner_profile` in `dataParser.ts` (TDD)

**Files:**
- Modify: `extension/src/services/dataParser.ts`
- Test: `extension/test/dataParser.test.ts`

- [ ] **Step 1: Write failing tests for `parseProgressData` with `learner_profile`**

  Add to the `describe("parseProgressData")` block in `extension/test/dataParser.test.ts`:

  ```ts
  it("parses learner_profile.last_updated when present", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
      learner_profile: { last_updated: "2026-03-01" },
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.learner_profile?.last_updated).toBe("2026-03-01");
  });

  it("sets learner_profile to undefined when absent", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.learner_profile).toBeUndefined();
  });

  it("sets learner_profile.last_updated to null when not a string", () => {
    const json = JSON.stringify({
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
      learner_profile: { last_updated: 42 },
    });
    const result = parseProgressData(json);
    expect(result).not.toBeNull();
    expect(result!.learner_profile?.last_updated).toBeNull();
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  Run from `extension/` directory:
  ```bash
  cd extension && npm test
  ```
  Expected: tests fail because `learner_profile` is not parsed yet.

- [ ] **Step 3: Implement `learner_profile` parsing in `parseProgressData`**

  In `extension/src/services/dataParser.ts`, add the parse logic inside `parseProgressData` before the `return` statement:

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
  ```

  Update the `return` object to include it:
  ```ts
  return {
    version: obj.version,
    current_plan: typeof obj.current_plan === "string" ? obj.current_plan : null,
    current_task: typeof obj.current_task === "string" ? obj.current_task : null,
    current_step: typeof obj.current_step === "number" ? obj.current_step : null,
    next_suggest: typeof obj.next_suggest === "string" ? obj.next_suggest : null,
    resume_context: typeof obj.resume_context === "string" ? obj.resume_context : null,
    completed_tasks: completedTasks,
    skipped_tasks: Array.isArray(obj.skipped_tasks)
      ? (obj.skipped_tasks as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    unresolved_gaps: Array.isArray(obj.unresolved_gaps)
      ? (obj.unresolved_gaps as unknown[]).filter(
          (item): item is UnresolvedGap =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as Record<string, unknown>).concept === "string" &&
            typeof (item as Record<string, unknown>).topic === "string" &&
            typeof (item as Record<string, unknown>).first_missed === "string" &&
            typeof (item as Record<string, unknown>).task === "string" &&
            typeof (item as Record<string, unknown>).note === "string",
        )
      : [],
    learner_profile: learnerProfile,
  };
  ```

- [ ] **Step 4: Write failing tests for `computeDashboardData` returning `profileLastUpdated`**

  Add these two `it()` cases **inside the existing** `describe("computeDashboardData")` block in `extension/test/dataParser.test.ts` (after the existing `it("handles empty history")` case, before the closing `});`):

  ```ts
  it("includes profileLastUpdated from learner_profile.last_updated", () => {
    const progress = {
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
      learner_profile: { last_updated: "2026-03-01" },
    };
    const result = computeDashboardData(progress, { history: [] }, []);
    expect(result.profileLastUpdated).toBe("2026-03-01");
  });

  it("returns null for profileLastUpdated when learner_profile is absent", () => {
    const progress = {
      version: "2.0",
      current_plan: null,
      current_task: null,
      current_step: null,
      next_suggest: null,
      resume_context: null,
      completed_tasks: [],
      skipped_tasks: [],
      unresolved_gaps: [],
    };
    const result = computeDashboardData(progress, { history: [] }, []);
    expect(result.profileLastUpdated).toBeNull();
  });
  ```

  Run: `cd extension && npm test`
  Expected: new tests fail because `computeDashboardData` doesn't return `profileLastUpdated` yet (TypeScript may also error on `DashboardData` shape).

- [ ] **Step 5: Implement `profileLastUpdated` in `computeDashboardData`**

  Update the `return` in `computeDashboardData` in `extension/src/services/dataParser.ts`:

  ```ts
  return {
    totalQuestions,
    correctRate,
    byTopic,
    unresolvedGaps: progress.unresolved_gaps,
    completedTasks: progress.completed_tasks,
    currentTask: progress.current_task,
    profileLastUpdated: progress.learner_profile?.last_updated ?? null,
  };
  ```

- [ ] **Step 6: Run all tests to verify they pass**

  ```bash
  cd extension && npm test
  ```
  Expected: all tests pass.

---

### Task 3: Add translation keys

**Files:**
- Modify: `extension/webview/src/i18n/translations.ts`

- [ ] **Step 1: Add 3 new keys to the `translations` object**

  In `extension/webview/src/i18n/translations.ts`, add inside the `translations` object (e.g. after `"settings.prompt.plan"`):

  ```ts
  "settings.profile.register": { ja: "プロフィール登録", en: "Register Profile" },
  "settings.profile.update": { ja: "プロフィール更新", en: "Update Profile" },
  "settings.prompt.intake": {
    ja: "docs/mentor/skills/intake/SKILL.md を読んで、インテークフローを実行してください。",
    en: "Read docs/mentor/skills/intake/SKILL.md and run the intake flow.",
  },
  ```

---

### Task 4: Add CSS classes

**Files:**
- Modify: `extension/webview/src/styles/main.css`

- [ ] **Step 1: Append new CSS classes to `main.css`**

  Add at the end of `extension/webview/src/styles/main.css`:

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

---

## Chunk 2: React Components (App.tsx and Settings.tsx)

### Task 5: Update `App.tsx`

**Files:**
- Modify: `extension/webview/src/App.tsx`

- [ ] **Step 1: Compute `settingsHasWarning` and update the Settings tab button**

  In `extension/webview/src/App.tsx`:

  1. Add `settingsHasWarning` derived value after the state declarations (e.g. after `const [enableMentor, ...]`):

     ```ts
     const settingsHasWarning =
       !config?.mentorFiles?.plan ||
       !data?.profileLastUpdated;
     ```

  2. Replace the Settings tab `<button>` (lines 98–104) to wrap children in `.tab-btn-inner` and add the badge:

     ```tsx
     <button
       className={tab === "settings" ? "active" : ""}
       onClick={() => setTab("settings")}
     >
       <span className="tab-btn-inner">
         <SettingsIcon />
         <span>{t("app.tab.settings", locale)}</span>
         {settingsHasWarning && <span className="tab-badge">!</span>}
       </span>
     </button>
     ```

  3. Update the Settings render in `<main>` to pass `profileLastUpdated`:

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

  Note: The other two tab buttons (actions, overview) keep their existing structure — only the Settings button gets the `.tab-btn-inner` wrapper.

---

### Task 6: Update `Settings.tsx`

**Files:**
- Modify: `extension/webview/src/components/Settings.tsx`

- [ ] **Step 1: Add `profileLastUpdated` prop to `SettingsProps` and `warning` to `FileSettingProps`**

  Update the interfaces:

  ```ts
  interface SettingsProps {
    config: MentorStudioConfig | null;
    locale: Locale;
    onLocaleChange: (locale: Locale) => void;
    profileLastUpdated: string | null;
  }

  interface FileSettingProps {
    label: string;
    field: FileField;
    value: string | null;
    createPrompt: string;
    locale: Locale;
    warning?: boolean;
  }
  ```

- [ ] **Step 2: Apply `setting-item--warning` in `FileSetting` when `warning` is true**

  Update both `<div className="setting-item">` in `FileSetting` (both the `if (value)` branch and the fallback):

  ```tsx
  <div className={`setting-item${warning ? " setting-item--warning" : ""}`}>
  ```

  Update the `FileSetting` function signature to destructure `warning`:

  ```ts
  function FileSetting({
    label,
    field,
    value,
    createPrompt,
    locale,
    warning,
  }: FileSettingProps) {
  ```

- [ ] **Step 3: Add `ProfileSection` component**

  Add new interfaces and component before the `Settings` export. Import `CopyIcon` from `./icons`:

  ```ts
  import { CheckIcon, CopyIcon, SparkleIcon } from "./icons";
  ```

  Add interfaces and component:

  ```ts
  interface ProfileSectionProps {
    profileLastUpdated: string | null;
    locale: Locale;
  }

  function ProfileSection({ profileLastUpdated, locale }: ProfileSectionProps) {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      return () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
      };
    }, []);

    const handleCopy = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      setCopied(true);
      postMessage({ type: "copy", text: t("settings.prompt.intake", locale) });
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className={`setting-item${!profileLastUpdated ? " setting-item--warning" : ""}`}>
        <button className="snippet-btn" onClick={handleCopy}>
          <span className="snippet-title">
            {profileLastUpdated
              ? t("settings.profile.update", locale)
              : t("settings.profile.register", locale)}
          </span>
          <span className="snippet-icon">
            {copied ? (
              <>
                <CheckIcon />
                <span className="snippet-copied-text">{t("actions.copied", locale)}</span>
              </>
            ) : (
              <CopyIcon />
            )}
          </span>
        </button>
        <p className="actions-description">{t("actions.description", locale)}</p>
      </div>
    );
  }
  ```

- [ ] **Step 4: Update `Settings` render — add `ProfileSection` first, add `warning` to plan `FileSetting`**

  Update `Settings` function signature to destructure `profileLastUpdated`:

  ```ts
  export function Settings({ config, locale, onLocaleChange, profileLastUpdated }: SettingsProps) {
  ```

  Update the render to add `ProfileSection` first and pass `warning` to the plan `FileSetting`:

  ```tsx
  return (
    <div className="settings">
      <p className="setting-guide">{t("settings.unsetGuide", locale)}</p>
      <ProfileSection profileLastUpdated={profileLastUpdated} locale={locale} />
      <FileSetting
        label={t("settings.plan", locale)}
        field="plan"
        value={mentorFiles.plan}
        createPrompt={t("settings.prompt.plan", locale)}
        locale={locale}
        warning={!mentorFiles.plan}
      />
      <FileSetting
        label={t("settings.spec", locale)}
        field="spec"
        value={mentorFiles.spec}
        createPrompt={t("settings.prompt.spec", locale)}
        locale={locale}
      />
      <div className="setting-item">
        <div className="setting-label">{t("settings.language", locale)}</div>
        <label className="locale-toggle">
          <span className={locale === "en" ? "locale-active" : ""}>English</span>
          <input
            type="checkbox"
            className="locale-checkbox"
            checked={locale === "ja"}
            onChange={() => onLocaleChange(locale === "ja" ? "en" : "ja")}
          />
          <span className={locale === "ja" ? "locale-active" : ""}>日本語</span>
        </label>
      </div>
    </div>
  );
  ```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

  ```bash
  cd extension && npx tsc --noEmit
  cd extension/webview && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 6: Run tests**

  ```bash
  cd extension && npm test
  ```
  Expected: all tests pass.
