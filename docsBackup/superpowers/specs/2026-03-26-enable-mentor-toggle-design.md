# Enable Mentor Toggle — Design Spec

**Date:** 2026-03-26
**Branch:** add-language-switch

## Overview

Add an `enableMentor` flag to `.mentor-studio.json` and a toggle in the Extension UI Settings. When disabled, Claude skips the mentor rules without modifying `CLAUDE.md`.

## Decisions

- `CLAUDE.md` continues to use `@docs/mentor/rules/MENTOR_RULES.md` (static `@` import — reliable, handled by Claude Code's file inclusion system)
- The conditional logic lives inside `MENTOR_RULES.md` itself (Activation Gate), not in `CLAUDE.md`
- `enableMentor` missing from config → treated as `true` (backwards-compatible default)
- `.mentor-studio.json` file missing or unparseable → treated as `true` (same fallback)
- `enableMentor` state lives in `App.tsx` (matches the `locale` pattern for optimistic UI updates)

## Known Limitation

The Activation Gate is a behavioral instruction to Claude (the model), not a technical enforcement mechanism. Claude is expected to read `.mentor-studio.json` at session start and honor the skip instruction, but this is not guaranteed. This is an accepted tradeoff — the alternative (dynamically modifying `CLAUDE.md`) introduces more complexity and risk.

## Components

### 1. `packages/shared/src/types.ts`

Add to `MentorStudioConfig`:
```ts
enableMentor?: boolean;  // undefined treated as true
```

Add to `WebviewMessage` union:
```ts
| { type: "setEnableMentor"; value: boolean }
```

### 2. `docs/mentor/rules/MENTOR_RULES.md` AND `extension/src/templates/mentorFiles.ts`

Both must be updated identically. `mentorFiles.ts` is the source of truth for new projects created via Setup; the file in `docs/mentor/rules/` is the live file for this repo.

Add at the top of the file (before all other content):

```markdown
## Activation Gate

Read `.mentor-studio.json`. If the file does not exist, cannot be parsed, or `enableMentor` is `false`, skip all rules in this file and behave normally.
```

### 3. `extension/src/extension.ts`

In the setup command, include `enableMentor: true` in the generated `.mentor-studio.json`. Field order: `repositoryName`, `enableMentor`, `topics`, `mentorFiles`.

```ts
{
  repositoryName: folderName,
  enableMentor: true,
  topics: [...],
  mentorFiles: { spec: null, plan: null },
}
```

### 4. `extension/src/views/sidebarProvider.ts`

Add message handler branch:
```ts
} else if (message.type === "setEnableMentor") {
  await this.updateEnableMentor(message.value);
}
```

Add method:
```ts
private async updateEnableMentor(value: boolean): Promise<void> {
  await this.updateConfig((config) => {
    config.enableMentor = value;
  });
}
```

The existing `updateConfig` method already reads from disk before mutating, broadcasts `{ type: "config" }` after writing, and has error handling via `vscode.window.showErrorMessage`. No additional handling needed.

### 5. `extension/webview/src/App.tsx`

Follow the same pattern as `locale`:

Add state:
```ts
const [enableMentor, setEnableMentor] = useState<boolean>(true);
```

In the `"config"` case of the message handler, sync from config:
```ts
case "config":
  setConfig(message.data);
  setHasConfig(true);
  if (message.data.locale) {
    setLocale(message.data.locale);
  }
  setEnableMentor(message.data.enableMentor ?? true);  // add this line
  break;
```

Add handler:
```ts
const handleEnableMentorChange = (value: boolean) => {
  setEnableMentor(value);
  postMessage({ type: "setEnableMentor", value });
};
```

Pass to `Settings`:
```tsx
<Settings
  config={config}
  locale={locale}
  onLocaleChange={handleLocaleChange}
  enableMentor={enableMentor}
  onEnableMentorChange={handleEnableMentorChange}
/>
```

### 6. `extension/webview/src/components/Settings.tsx`

Add props to `SettingsProps`:
```ts
enableMentor: boolean;
onEnableMentorChange: (value: boolean) => void;
```

Add toggle above the language toggle, reusing `locale-toggle` / `locale-checkbox` CSS classes (generic toggle styles). No description sub-label needed (same pattern as the language toggle):

```tsx
<div className="setting-item">
  <div className="setting-label">{t("settings.enableMentor", locale)}</div>
  <label className="locale-toggle">
    <input
      type="checkbox"
      className="locale-checkbox"
      checked={enableMentor}
      onChange={() => onEnableMentorChange(!enableMentor)}
    />
  </label>
</div>
```

### 7. `extension/webview/src/i18n/translations.ts`

Add translation key:
- `ja`: `"メンター機能"`
- `en`: `"Mentor"`

## Data Flow

```
User toggles UI
  → onEnableMentorChange(!enableMentor)
  → App.tsx: setEnableMentor(value) [optimistic, immediate UI update]
  → App.tsx: postMessage({ type: "setEnableMentor", value })
  → sidebarProvider: updateConfig reads disk → mutates → writes .mentor-studio.json
  → sidebarProvider: broadcasts { type: "config", data: updatedConfig }
  → App.tsx "config" handler: setEnableMentor(config.enableMentor ?? true) [confirms round-trip]
```

At next Claude Code session:
```
Claude Code loads CLAUDE.md
  → expands @docs/mentor/rules/MENTOR_RULES.md into context
  → Claude reads Activation Gate
  → Claude reads .mentor-studio.json to check enableMentor
  → if file missing, unparseable, or enableMentor != false: follows mentor rules normally
  → if enableMentor === false: skips all mentor rules
```

## Out of Scope

- No changes to `CLAUDE.md` structure or the `@` import
- No migration needed for existing `.mentor-studio.json` files (missing key = true)
- No UI changes to the Actions panel
