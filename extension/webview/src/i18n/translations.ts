import type { Locale } from "@mentor-studio/shared";

const translations = {
  // Actions tab
  "actions.description": {
    ja: "AIへのプロンプトがコピーされます。そのままチャットに貼り付けて使えます。",
    en: "Copy the AI prompt. Paste it into your AI chat.",
  },
  "actions.copied": { ja: "Copied!", en: "Copied!" },
  "actions.startNextTask": { ja: "次のタスクを始める", en: "Start next task" },
  "actions.reviewImplementation": {
    ja: "実装をレビューする",
    en: "Review implementation",
  },
  "actions.startReview": { ja: "復習を始める", en: "Start review" },
  "actions.startCheck": {
    ja: "理解度チェックを始める",
    en: "Start Comprehension check",
  },
  "actions.prompt.startNextTask": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、次のタスクを始めましょう。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and start the next task.",
  },
  "actions.prompt.reviewImplementation": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、現在のタスクの実装をレビューしてください。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and review the current task implementation.",
  },
  "actions.prompt.startReview": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、unresolved_gaps にある概念の復習を始めましょう。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and start reviewing concepts in unresolved_gaps.",
  },
  "actions.prompt.startCheck": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、現在のプロジェクトに関わる学習ポイントについて理解度チェックを実施してください。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md, and run a comprehension check for the current project's learning points.",
  },

  // Overview tab
  "overview.totalQuestions": { ja: "回答数", en: "Total Questions" },
  "overview.correctRate": { ja: "正答率", en: "Correct Rate" },
  "overview.currentTask": { ja: "現在のタスク", en: "Current Task" },
  "overview.taskPrefix": { ja: "Task", en: "Task" },
  "overview.notStarted": { ja: "未開始", en: "Not started" },
  "overview.topics": { ja: "復習トピック", en: "Review Topics" },
  "overview.noData": { ja: "データなし", en: "No data yet" },
  "overview.topic.scoreUnit": { ja: "問", en: "" },
  "overview.topic.reviewSample": {
    ja: "復習内容の一部",
    en: "Review sample",
  },
  "overview.topic.copyHint": {
    ja: "AIへのプロンプトがコピーされます。そのままチャットに貼り付けて使えます。",
    en: "Copy the AI prompt. Paste it into your AI chat.",
  },
  "overview.topic.copyReview": {
    ja: "トピック復習",
    en: "Review this Topic",
  },
  "overview.topic.editLabel": { ja: "ラベル編集", en: "Edit Label" },
  "overview.topic.save": { ja: "保存", en: "Save" },
  "overview.topic.cancel": { ja: "キャンセル", en: "Cancel" },
  "overview.topic.mergeTo": { ja: "統合先", en: "Merge into" },
  "overview.topic.merge": { ja: "統合", en: "Merge" },
  "overview.topic.newTopic": { ja: "新しいトピック", en: "New topic" },
  "overview.topic.reviewPrompt": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、{label} の復習を始めましょう。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and start reviewing {label}.",
  },

  // Settings tab
  "settings.spec": { ja: "仕様 (任意)", en: "Spec (optional)" },
  "settings.plan": {
    ja: "実装プラン (必須)",
    en: "Implementation Plan (required)",
  },
  "settings.unset": { ja: "⚠ 未設定", en: "⚠ Not set" },
  "settings.unsetGuide": {
    ja: "ワークスペース内のファイルを選択してください",
    en: "Select a file from your workspace",
  },
  "settings.selectFile": { ja: "ファイルを選択", en: "Select File" },
  "settings.createPrompt": { ja: "プロンプトを作成", en: "Create prompt" },
  "settings.createPrompt.plan": {
    ja: "AIとプランを作成",
    en: "Create plan with AI",
  },
  "settings.createPrompt.spec": {
    ja: "AIと仕様を作成",
    en: "Create spec with AI",
  },
  "settings.change": { ja: "変更", en: "Change" },
  "settings.detach": { ja: "外す", en: "Detach" },
  "settings.language": { ja: "Language / 言語", en: "Language" },
  "settings.enableMentor": { ja: "メンター機能", en: "Mentor" },
  "settings.prompt.spec": {
    ja: "docs/mentor/rules/CREATE_SPEC.md を読んで、仕様ファイルを作成してください。不足している情報があればユーザーに質問してください。/brainstorm",
    en: "Read docs/mentor/rules/CREATE_SPEC.md and create a spec file. Ask the user if any information is missing. /brainstorm",
  },
  "settings.prompt.plan": {
    ja: "docs/mentor/rules/CREATE_PLAN.md を読んで、プランファイルを作成してください。何のプランを作るかはユーザーに質問してください。/write-plan",
    en: "Read docs/mentor/rules/CREATE_PLAN.md and create a plan file. Ask the user what kind of plan to create. /write-plan",
  },
  "settings.profile.register": {
    ja: "プロフィール登録",
    en: "Register Profile",
  },
  "settings.profile.update": { ja: "プロフィール更新", en: "Update Profile" },
  "settings.copyCreatePrompt": {
    ja: "このファイルを作成するプロンプトをコピー",
    en: "Copy prompt to create this file",
  },
  "settings.prompt.intake": {
    ja: "docs/mentor/skills/intake/SKILL.md を読んで、プロフィールを更新してください。",
    en: "Read docs/mentor/skills/intake/SKILL.md and update my profile.",
  },

  // No-config screen
  "app.noConfig.notFound": {
    ja: "が見つかりません。",
    en: "not found.",
  },
  "app.noConfig.instruction": {
    ja: '下のボタンをクリックするか、コマンドパレットから "Mentor Studio: Setup Mentor" を実行してください。',
    en: 'Click the button below, or run "Mentor Studio: Setup Mentor" from the command palette.',
  },
  "app.noConfig.button": {
    ja: "セットアップを実行する",
    en: "Run Setup",
  },
  "app.noConfig.hint": {
    ja: ".mentor-studio.json を作成し、メンターの初期設定を行います。",
    en: "Creates .mentor-studio.json and sets up the initial mentor configuration.",
  },

  // App-level
  "app.warning": { ja: "警告あり", en: "Has warnings" },
  "app.menu": { ja: "メニュー", en: "Menu" },
  "app.addTopicFailed": {
    ja: "トピックの追加に失敗しました",
    en: "Failed to add topic",
  },
  "app.tab.actions": { ja: "Actions", en: "Actions" },
  "app.tab.overview": { ja: "Overview", en: "Overview" },
  "app.tab.settings": { ja: "Settings", en: "Settings" },
  "app.status.loaded": {
    ja: "✓ データ読み込み済み",
    en: "✓ Local data loaded",
  },
  "app.status.loading": { ja: "読み込み中...", en: "Loading..." },
} as const satisfies Record<string, Record<Locale, string>>;

export type TranslationKey = keyof typeof translations;
export { translations };
