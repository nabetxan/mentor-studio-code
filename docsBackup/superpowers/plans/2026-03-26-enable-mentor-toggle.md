# Enable Mentor Toggle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `enableMentor` toggle to `.mentor-studio.json` and the Extension UI Settings, so Claude follows mentor rules only when enabled.

**Architecture:** `enableMentor?: boolean` added to the shared config type and propagated through the existing extension ↔ webview message protocol. The Activation Gate lives at the top of `MENTOR_RULES.md` — Claude checks the flag at session start. UI follows the same optimistic-update pattern as the locale toggle.

**Tech Stack:** TypeScript, React, VSCode Extension API, vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-26-enable-mentor-toggle-design.md`

---

## Chunk 1: Data layer — types, MENTOR_RULES, setup config, sidebarProvider

### Task 1: Add `enableMentor` to shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add `enableMentor` to `MentorStudioConfig`**

In `packages/shared/src/types.ts`, add `enableMentor?: boolean` to `MentorStudioConfig`:

```ts
export interface MentorStudioConfig {
  repositoryName: string;
  topics: TopicConfig[];
  mentorFiles?: MentorFiles;
  locale?: Locale;
  enableMentor?: boolean;
}
```

- [ ] **Step 2: Add `setEnableMentor` to `WebviewMessage`**

```ts
export type WebviewMessage =
  | { type: "copy"; text: string }
  | { type: "ready" }
  | { type: "runSetup" }
  | { type: "selectFile"; field: FileField }
  | { type: "clearFile"; field: FileField }
  | { type: "setLocale"; locale: Locale }
  | { type: "setEnableMentor"; value: boolean };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from repo root:
```bash
npm run build
```
Expected: no type errors (build may fail on other reasons — check only for type errors in `types.ts`)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add enableMentor to MentorStudioConfig and WebviewMessage types"
```

---

### Task 2: Add Activation Gate to MENTOR_RULES.md and template

**Files:**
- Modify: `docs/mentor/rules/MENTOR_RULES.md`
- Modify: `extension/src/templates/mentorFiles.ts`

- [ ] **Step 1: Add Activation Gate to `docs/mentor/rules/MENTOR_RULES.md`**

Insert the `## Activation Gate` section after the `# Mentor Studio Code` H1 and before `## BLOCKING RULE`. The final file should read:

```markdown
# Mentor Studio Code

## Activation Gate

Read `.mentor-studio.json`. If the file does not exist, cannot be parsed, or `enableMentor` is `false`, skip all rules in this file and behave normally.

## BLOCKING RULE

After the user answers any question the mentor asks, **immediately** record it in `docs/mentor/question-history.json`. Do not proceed to the next action (code, next question, task update) until recorded.

## Session Start

Load `docs/mentor/skills/mentor-session/SKILL.md`
```

- [ ] **Step 2: Add Activation Gate to the template in `mentorFiles.ts`**

In `extension/src/templates/mentorFiles.ts`, update `MENTOR_RULES_MD`:

```ts
export const MENTOR_RULES_MD = `# Mentor Studio Code

## Activation Gate

Read \`.mentor-studio.json\`. If the file does not exist, cannot be parsed, or \`enableMentor\` is \`false\`, skip all rules in this file and behave normally.

## BLOCKING RULE

After the user answers any question the mentor asks, **immediately** record it in \`docs/mentor/question-history.json\`. Do not proceed to the next action (code, next question, task update) until recorded.

## Session Start

Load \`docs/mentor/skills/mentor-session/SKILL.md\`
`;
```

- [ ] **Step 3: Verify both files have identical Activation Gate wording**

Manually compare the two files.

- [ ] **Step 4: Commit**

```bash
git add docs/mentor/rules/MENTOR_RULES.md extension/src/templates/mentorFiles.ts
git commit -m "feat: add Activation Gate to MENTOR_RULES.md and template"
```

---

### Task 3: Add `enableMentor: true` to setup-generated config

**Files:**
- Modify: `extension/src/extension.ts`

- [ ] **Step 1: Add `enableMentor: true` to the config object in setup command**

In `extension/src/extension.ts`, find the `configContent` definition (around line 76). Update the object to include `enableMentor: true` between `repositoryName` and `topics`:

```ts
const configContent =
  JSON.stringify(
    {
      repositoryName: folderName,
      enableMentor: true,
      topics: [
        { key: "html", label: "HTML" },
        { key: "css", label: "CSS" },
        { key: "javascript", label: "JavaScript" },
        { key: "typescript", label: "TypeScript" },
      ],
      mentorFiles: { spec: null, plan: null },
    },
    null,
    2,
  ) + "\n";
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add extension/src/extension.ts
git commit -m "feat: include enableMentor: true in setup-generated .mentor-studio.json"
```

---

### Task 4: Handle `setEnableMentor` in sidebarProvider

**Files:**
- Modify: `extension/src/views/sidebarProvider.ts`

Note: The UI wiring (Settings toggle + App state) is in Chunk 2. The handler added here is exercised end-to-end only after Chunk 2 is complete.

- [ ] **Step 1: Add `updateEnableMentor` private method**

In `extension/src/views/sidebarProvider.ts`, add after `updateLocale` (around line 139):

```ts
private async updateEnableMentor(value: boolean): Promise<void> {
  await this.updateConfig((config) => {
    config.enableMentor = value;
  });
}
```

- [ ] **Step 2: Add message handler branch**

In `resolveWebviewView`, add a new `else if` branch after the `setLocale` handler (around line 74):

```ts
} else if (message.type === "setEnableMentor") {
  await this.updateEnableMentor(message.value);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add extension/src/views/sidebarProvider.ts
git commit -m "feat: handle setEnableMentor message in sidebarProvider"
```

---

## Chunk 2: UI layer — i18n, Settings, App

> **Prerequisites:** Chunk 1 must be complete before starting Chunk 2. `enableMentor?: boolean` in `MentorStudioConfig` and `setEnableMentor` in `WebviewMessage` are added in Task 1 of Chunk 1.

### Task 5: Add translation key

**Files:**
- Modify: `extension/webview/src/i18n/translations.ts`

- [ ] **Step 1: Add `settings.enableMentor` translation key**

In `extension/webview/src/i18n/translations.ts`, add after the `settings.language` entry:

```ts
"settings.enableMentor": { ja: "メンター機能", en: "Mentor" },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add extension/webview/src/i18n/translations.ts
git commit -m "feat: add settings.enableMentor translation key"
```

---

### Task 6: Add enableMentor toggle to Settings component

**Files:**
- Modify: `extension/webview/src/components/Settings.tsx`
- Modify: `extension/webview/test/Settings.test.tsx`

- [ ] **Step 1: Write failing tests**

In `extension/webview/test/Settings.test.tsx`:

1. Update `defaultProps` to include the new required props:

```ts
const defaultProps = {
  config: null as MentorStudioConfig | null,
  locale: "ja" as const,
  onLocaleChange: () => {},
  enableMentor: true,
  onEnableMentorChange: () => {},
};
```

2. Fix the existing test `"calls onLocaleChange when toggle clicked"` — it uses `screen.getByRole("checkbox")` which will find multiple checkboxes. Update it to use the locale-specific checkbox by label:

```ts
it("calls onLocaleChange when toggle clicked", () => {
  const onLocaleChange = vi.fn();
  render(<Settings {...defaultProps} onLocaleChange={onLocaleChange} />);
  const checkboxes = screen.getAllByRole("checkbox");
  // locale toggle is the second checkbox (enableMentor is first)
  fireEvent.click(checkboxes[1]);
  expect(onLocaleChange).toHaveBeenCalledWith("en");
});
```

3. Add new tests at the end:

```ts
it("renders enableMentor toggle", () => {
  render(<Settings {...defaultProps} />);
  expect(screen.getByText("メンター機能")).toBeTruthy();
  const checkboxes = screen.getAllByRole("checkbox");
  expect(checkboxes).toHaveLength(2);
  expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
});

it("renders enableMentor toggle unchecked when false", () => {
  render(<Settings {...defaultProps} enableMentor={false} />);
  const checkboxes = screen.getAllByRole("checkbox");
  expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
});

it("calls onEnableMentorChange when enableMentor toggle clicked", () => {
  const onEnableMentorChange = vi.fn();
  render(<Settings {...defaultProps} onEnableMentorChange={onEnableMentorChange} />);
  const checkboxes = screen.getAllByRole("checkbox");
  fireEvent.click(checkboxes[0]);
  expect(onEnableMentorChange).toHaveBeenCalledWith(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extension/webview && npm test
```

Expected: TypeScript errors on missing props + test failures

- [ ] **Step 3: Implement the toggle in Settings.tsx**

Update `SettingsProps` to include new props:

```ts
interface SettingsProps {
  config: MentorStudioConfig | null;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  enableMentor: boolean;
  onEnableMentorChange: (value: boolean) => void;
}
```

Update the function signature:

```ts
export function Settings({ config, locale, onLocaleChange, enableMentor, onEnableMentorChange }: SettingsProps) {
```

Add the toggle above the language toggle (inside the `<div className="settings">`, before the language `<div className="setting-item">`):

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extension/webview && npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add extension/webview/src/components/Settings.tsx extension/webview/test/Settings.test.tsx
git commit -m "feat: add enableMentor toggle to Settings component"
```

---

### Task 7: Wire enableMentor state in App.tsx

**Files:**
- Modify: `extension/webview/src/App.tsx`
- Modify: `extension/webview/test/App.test.tsx`

- [ ] **Step 1: Write failing tests**

In `extension/webview/test/App.test.tsx`:

1. Fix the existing test `"sends setLocale message when locale is changed"` — it uses `screen.getByRole("checkbox")` which will find multiple checkboxes. Update it:

```ts
it("sends setLocale message when locale is changed", () => {
  render(<App />);
  simulateMessage({ type: "config", data: mockConfig });
  fireEvent.click(screen.getByText("Settings"));
  const checkboxes = screen.getAllByRole("checkbox");
  // locale toggle is the second checkbox
  fireEvent.click(checkboxes[1]);
  expect(mockApi.postMessage).toHaveBeenCalledWith({
    type: "setLocale",
    locale: "en",
  });
});
```

2. Add new tests:

```ts
it("enableMentor toggle defaults to true when config has no enableMentor key", () => {
  render(<App />);
  simulateMessage({ type: "config", data: mockConfig });
  fireEvent.click(screen.getByText("Settings"));
  const checkboxes = screen.getAllByRole("checkbox");
  expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
});

it("enableMentor toggle reflects false from config", () => {
  render(<App />);
  simulateMessage({ type: "config", data: { ...mockConfig, enableMentor: false } });
  fireEvent.click(screen.getByText("Settings"));
  const checkboxes = screen.getAllByRole("checkbox");
  expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
});

it("sends setEnableMentor message when enableMentor toggle clicked", () => {
  render(<App />);
  simulateMessage({ type: "config", data: mockConfig });
  fireEvent.click(screen.getByText("Settings"));
  const checkboxes = screen.getAllByRole("checkbox");
  fireEvent.click(checkboxes[0]);
  expect(mockApi.postMessage).toHaveBeenCalledWith({
    type: "setEnableMentor",
    value: false,
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
cd extension/webview && npm test
```

Expected: new tests fail (Settings props mismatch + missing handler)

- [ ] **Step 3: Implement in App.tsx**

Add `enableMentor` state after the `locale` state:

```ts
const [enableMentor, setEnableMentor] = useState<boolean>(true);
```

In the `"config"` case of the message handler, sync `enableMentor` from config:

```ts
case "config":
  setConfig(message.data);
  setHasConfig(true);
  if (message.data.locale) {
    setLocale(message.data.locale);
  }
  setEnableMentor(message.data.enableMentor ?? true);
  break;
```

Add the handler after `handleLocaleChange`:

```ts
const handleEnableMentorChange = (value: boolean) => {
  setEnableMentor(value);
  postMessage({ type: "setEnableMentor", value });
};
```

Pass the new props to `<Settings>`:

```tsx
<Settings
  config={config}
  locale={locale}
  onLocaleChange={handleLocaleChange}
  enableMentor={enableMentor}
  onEnableMentorChange={handleEnableMentorChange}
/>
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
cd extension/webview && npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add extension/webview/src/App.tsx extension/webview/test/App.test.tsx
git commit -m "feat: wire enableMentor state and handler in App"
```

---

### Task 8: Final build verification

- [ ] **Step 1: Run full build from root**

```bash
npm run build
```

Expected: build succeeds with no errors

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests PASS (root `package.json` runs `npm run test --workspaces --if-present`, which includes `extension/webview`)

- [ ] **Step 3: Manual smoke test (optional)**

Open the extension in VS Code Extension Host (`F5`), open a workspace with `.mentor-studio.json`, go to Settings tab, verify the Mentor toggle appears above the Language toggle and responds to clicks.
