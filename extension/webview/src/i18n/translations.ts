import type { Locale } from "@mentor-studio/shared";

const translations = {
  // Actions tab
  "actions.title": { ja: "メンターアクション", en: "Mentor Actions" },
  "actions.description": {
    ja: "ボタンを押すとAIへのプロンプトがコピーされます。そのままAIのチャットに貼り付けて投げよう。",
    en: "Press a button to copy the AI prompt. Paste it into your AI chat.",
  },
  "actions.copied": { ja: "Copied!", en: "Copied!" },
  "actions.startNextTask": { ja: "Start next task", en: "Start next task" },
  "actions.reviewImplementation": {
    ja: "Review implementation",
    en: "Review implementation",
  },
  "actions.startReview": { ja: "Start 復習", en: "Start review" },
  "actions.startCheck": {
    ja: "Start 理解度チェック",
    en: "Start comprehension check",
  },
  "actions.prompt.startNextTask": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、次のタスクを始めてください。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and start the next task.",
  },
  "actions.prompt.reviewImplementation": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、現在のタスクの実装をレビューしてください。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and review the current task implementation.",
  },
  "actions.prompt.startReview": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、unresolved_gaps にある概念の復習を始めてください。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and start reviewing concepts in unresolved_gaps.",
  },
  "actions.prompt.startCheck": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、app-design と roadmap を確認し、現在のタスクに関連する理解度チェックを実施してください。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md, check app-design and roadmap, and run a comprehension check for the current task.",
  },

  // Overview tab
  "overview.totalQuestions": { ja: "回答数", en: "Total Questions" },
  "overview.correctRate": { ja: "正答率", en: "Correct Rate" },
  "overview.currentTask": { ja: "現在のタスク", en: "Current Task" },
  "overview.taskPrefix": { ja: "Task", en: "Task" },
  "overview.unresolvedGaps": {
    ja: "未解決の理解ギャップ",
    en: "Unresolved Gaps",
  },
  "overview.topics": { ja: "トピック", en: "Topics" },
  "overview.noData": { ja: "データなし", en: "No data yet" },

  // Settings tab
  "settings.mentorFiles": { ja: "メンターファイル", en: "Mentor Files" },
  "settings.appDesign": { ja: "App Design", en: "App Design" },
  "settings.roadmap": { ja: "Roadmap / Plan", en: "Roadmap / Plan" },
  "settings.unset": { ja: "⚠ 未設定", en: "⚠ Not set" },
  "settings.unsetGuide": {
    ja: "ワークスペース内のファイルを選択してください",
    en: "Select a file from your workspace",
  },
  "settings.selectFile": { ja: "Select File", en: "Select File" },
  "settings.createPrompt": { ja: "Create prompt", en: "Create prompt" },
  "settings.change": { ja: "Change", en: "Change" },
  "settings.language": { ja: "言語 / Language", en: "Language" },
  "settings.prompt.appDesign": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、このプロジェクトの app-design.md を作成してください。不足している情報があればユーザーに質問してください。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and create an app-design.md for this project. Ask the user if any information is missing.",
  },
  "settings.prompt.roadmap": {
    ja: "docs/mentor/rules/MENTOR_RULES.md を読んで、このプロジェクトの learning-roadmap.md を作成してください。不足している情報があればユーザーに質問してください。",
    en: "Read docs/mentor/rules/MENTOR_RULES.md and create a learning-roadmap.md for this project. Ask the user if any information is missing.",
  },

  // App-level
  "app.tab.actions": { ja: "Actions", en: "Actions" },
  "app.tab.overview": { ja: "Overview", en: "Overview" },
  "app.tab.settings": { ja: "Settings", en: "Settings" },
  "app.status.loaded": {
    ja: "✓ データ読み込み済み",
    en: "✓ Local data loaded",
  },
  "app.status.loading": { ja: "読み込み中...", en: "Loading..." },
  "app.noConfig.line1": { ja: "が見つかりません。", en: "not found." },
  "app.noConfig.line2": {
    ja: 'コマンドパレットから "Mentor Studio: Setup Mentor" を実行してください。',
    en: 'Run "Mentor Studio: Setup Mentor" from the command palette.',
  },
} as const satisfies Record<string, Record<Locale, string>>;

export type TranslationKey = keyof typeof translations;
export { translations };
