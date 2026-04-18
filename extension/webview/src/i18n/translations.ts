import type { Locale } from "@mentor-studio/shared";

const translations = {
  // Actions tab
  "actions.description": {
    ja: "AIへのプロンプトがコピーされます。そのままチャットに貼り付けて使えます。",
    en: "Copy the AI prompt. Paste it into your AI chat.",
  },
  "actions.copied": { ja: "Copied!", en: "Copied!" },
  "actions.startNextTask": { ja: "タスクを始める", en: "Start task" },
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
    ja: "@.mentor/rules/MENTOR_RULES.md [flow:session-start] タスク開始",
    en: "@.mentor/rules/MENTOR_RULES.md [flow:session-start] Start the task.",
  },
  "actions.prompt.reviewImplementation": {
    ja: "@.mentor/rules/MENTOR_RULES.md [flow:implementation-review] 現在のタスクの実装をレビューしてください。",
    en: "@.mentor/rules/MENTOR_RULES.md [flow:implementation-review] Review the current task implementation.",
  },
  "actions.prompt.startReview": {
    ja: "@.mentor/rules/MENTOR_RULES.md [flow:review] これまでの学習でつまづいた概念の復習を始めましょう。",
    en: "@.mentor/rules/MENTOR_RULES.md [flow:review] Start reviewing concepts the learner has stumbled on.",
  },
  "actions.prompt.startCheck": {
    ja: "@.mentor/rules/MENTOR_RULES.md [flow:comprehension-check] 現在のプロジェクトに関わる学習ポイントについて理解度チェックを実施してください。",
    en: "@.mentor/rules/MENTOR_RULES.md [flow:comprehension-check] Run a comprehension check for the current project's learning points.",
  },
  "actions.tooltip.startNextTask": {
    ja: "クリックでプロンプトをコピー → AIチャットに貼り付けてタスクを開始。タスクがセットされていない時は何をやりたいか教えてください。",
    en: "Click to copy prompt → paste in AI chat to start a task. If no task is set, tell the AI what you'd like to work on",
  },
  "actions.tooltip.reviewImplementation": {
    ja: "クリックでプロンプトをコピー → AIチャットに貼り付けて実装をレビュー。今のタスクが実装できているかコードレビューします。",
    en: "Click to copy prompt → paste in AI chat to review implementation. Once your current task is implemented, get a code review",
  },
  "actions.tooltip.startReview": {
    ja: "クリックでプロンプトをコピー → AIチャットに貼り付けて復習を開始。これまでつまづいた問題を出していきます。",
    en: "Click to copy prompt → paste in AI chat to start review. You'll get questions on concepts you've stumbled on before",
  },
  "actions.tooltip.startCheck": {
    ja: "クリックでプロンプトをコピー → AIチャットに貼り付けて理解度チェックを開始。プロジェクト横断的に出題されます。",
    en: "Click to copy prompt → paste in AI chat to start comprehension check. Questions will cover topics across the project",
  },

  // Overview tab
  "overview.totalQuestions": { ja: "回答数", en: "Total Questions" },
  "overview.correctRate": { ja: "正答率", en: "Correct Rate" },
  "overview.currentTask": { ja: "現在のタスク", en: "Current Task" },
  "overview.taskPrefix": { ja: "Task", en: "Task" },
  "overview.notStarted": { ja: "未開始", en: "Not started" },
  "overview.topics": { ja: "復習トピック", en: "Review Topics" },
  "overview.noData": { ja: "データなし", en: "No data yet" },
  "overview.allCorrect": {
    ja: "全問正解！やったね！",
    en: "All correct! Great job!",
  },
  "overview.topic.scoreUnit": { ja: "問", en: "" },
  "overview.topic.reviewSample": {
    ja: "復習内容の一部",
    en: "Review sample",
  },
  "overview.topic.copyHint": {
    ja: "クリックでプロンプトをコピー → AIチャットに貼り付けてこのトピックの復習を開始。これまでつまづいた問題を出していきます。",
    en: "Click to copy prompt → paste in AI chat to start reviewing this topic. You'll get questions on concepts you've stumbled on before.",
  },
  "overview.topic.copyReview": {
    ja: "トピック復習",
    en: "Review this Topic",
  },
  "overview.topic.editLabel": { ja: "ラベル編集", en: "Edit Label" },
  "overview.topic.save": { ja: "保存", en: "Save" },
  "overview.topic.cancel": { ja: "キャンセル", en: "Cancel" },
  "overview.topic.mergeSection": {
    ja: "トピックの統合",
    en: "Merge Topics",
  },
  "overview.topic.mergeSource": { ja: "統合元", en: "Source" },
  "overview.topic.mergeTo": { ja: "統合先", en: "Merge into" },
  "overview.topic.merge": { ja: "統合", en: "Merge" },
  "overview.topic.mergeSelectSource": {
    ja: "トピックを選択",
    en: "Select topic",
  },
  "overview.topic.mergeSelectSourceHint": {
    ja: "統合元のトピックを選択してください",
    en: "Select a source topic to merge from",
  },
  "overview.topic.deleteSection": {
    ja: "トピックの削除",
    en: "Delete Topics",
  },
  "overview.topic.delete": { ja: "削除", en: "Delete" },
  "overview.topic.deleteHint": {
    ja: "紐づく学習データがあるトピックは削除できません。既存の他のトピックまたは新しいトピックに統合すると削除できるようになります。",
    en: "Topics with linked learning data cannot be deleted. Merge them into another topic (existing or new) to enable deletion.",
  },
  "overview.topic.selectTopics": {
    ja: "削除するトピックを選択",
    en: "Select topics to delete",
  },
  "overview.topic.selectedCount": {
    ja: "{count}件 選択中",
    en: "{count} selected",
  },
  "overview.topic.noTopics": {
    ja: "すべてのトピックに学習データがあるため削除できません",
    en: "All topics have learning data and cannot be deleted",
  },
  "overview.error.dismiss": { ja: "閉じる", en: "Dismiss" },
  "app.deleteTopicError.has_related_data": {
    ja: "紐づく学習データがあるため削除できません",
    en: "Cannot delete: topic has linked learning data",
  },
  "app.deleteTopicError.topic_not_found": {
    ja: "トピックが見つかりません",
    en: "Topic not found",
  },
  "app.deleteTopicError.config_not_loaded": {
    ja: "設定が読み込まれていません",
    en: "Config not loaded",
  },
  "app.deleteTopicError.delete_failed": {
    ja: "トピックの削除に失敗しました",
    en: "Failed to delete topic",
  },
  "app.deleteTopicError.read_history_failed": {
    ja: "学習履歴の読み込みに失敗しました",
    en: "Failed to read question history",
  },
  "app.deleteTopicError.read_progress_failed": {
    ja: "進捗データの読み込みに失敗しました",
    en: "Failed to read progress data",
  },
  "overview.topic.newTopic": { ja: "新しいトピック", en: "New topic" },
  "overview.activePlan.none": {
    ja: "アクティブなプランがありません — `add-plan` CLI またはプランパネルで作成してください",
    en: "No active plan — create one via `add-plan` CLI or the Plan Panel",
  },
  "overview.activePlan.uiOnly": {
    ja: "(UIのみのプラン)",
    en: "(UI-only plan)",
  },
  "overview.topic.reviewPrompt": {
    ja: "@.mentor/rules/MENTOR_RULES.md [flow:review] {label} の復習を始めましょう。",
    en: "@.mentor/rules/MENTOR_RULES.md [flow:review] Start reviewing {label}.",
  },

  // Settings tab
  "settings.spec": { ja: "仕様 (任意)", en: "Spec (optional)" },
  "settings.plan": {
    ja: "実装プラン (必須)",
    en: "Implementation Plan (required)",
  },
  "settings.plan.section": {
    ja: "プラン",
    en: "Plan",
  },
  "settings.plan.activeLabel": {
    ja: "Active:",
    en: "Active:",
  },
  "settings.plan.nextLabel": {
    ja: "Next:",
    en: "Next:",
  },
  "settings.planPanel.openButton": {
    ja: "パネルを開く",
    en: "Open Panel",
  },
  "settings.activePlan.uiOnly": {
    ja: "(UIのみのプラン)",
    en: "(UI-only plan)",
  },
  "settings.activePlan.activate": { ja: "有効化", en: "Activate" },
  "settings.activePlan.activateFailed": {
    ja: "プランの有効化に失敗しました",
    en: "Failed to activate plan",
  },
  "settings.activePlan.deactivateFailed": {
    ja: "プランの無効化に失敗しました",
    en: "Failed to deactivate plan",
  },
  "settings.unset": { ja: "⚠ 未設定", en: "⚠ Not set" },
  "settings.unsetGuide": {
    ja: "ワークスペース内のファイルを選択してください",
    en: "Select a file from your workspace",
  },
  "settings.selectFile": { ja: "ファイルを選択", en: "Select File" },
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
    ja: "@.mentor/rules/CREATE_SPEC.md 仕様ファイルを作成してください。不足している情報があればユーザーに質問してください。仕様作成に使える外部スキルがあれば活用してください。",
    en: "@.mentor/rules/CREATE_SPEC.md Create a spec file. Ask the user if any information is missing. If any external skill for spec creation is available, feel free to use it.",
  },
  "settings.prompt.plan": {
    ja: "@.mentor/rules/CREATE_PLAN.md プランファイルを作成してください。何のプランを作るかはユーザーに質問してください。プラン作成に使える外部スキルがあれば活用してください。",
    en: "@.mentor/rules/CREATE_PLAN.md Create a plan file. Ask the user what kind of plan to create. If any external skill for plan creation is available, feel free to use it.",
  },
  "settings.profile.register": {
    ja: "プロフィール登録",
    en: "Register Profile",
  },
  "settings.profile.update": { ja: "プロフィール更新", en: "Update Profile" },
  "settings.profile.lastUpdated": {
    ja: "最終更新:",
    en: "Last updated:",
  },
  "settings.copyCreatePrompt.plan": {
    ja: "クリックでプロンプトをコピー → AIチャットに貼り付けて実装プランを作成",
    en: "Click to copy prompt → paste in AI chat to create an implementation plan",
  },
  "settings.copyCreatePrompt.spec": {
    ja: "クリックでプロンプトをコピー → AIチャットに貼り付けて仕様を作成",
    en: "Click to copy prompt → paste in AI chat to create a spec",
  },
  "settings.copyCreatePrompt.profile": {
    ja: "クリックでプロンプトをコピー → AIチャットに貼り付けてプロフィールを登録・更新。5つの質問に答えると、あなたに合った学習体験が提供されます。",
    en: "Click to copy prompt → paste in AI chat to register or update your profile. Answering five questions will provide a personalized learning experience.",
  },
  "settings.prompt.intake": {
    ja: "@.mentor/skills/intake/SKILL.md プロフィールを更新してください。",
    en: "@.mentor/skills/intake/SKILL.md Update my profile.",
  },
  "settings.setup.title": {
    ja: "セットアップ（手動実行）",
    en: "Setup (Manual)",
  },
  "settings.setup.description": {
    ja: "ルールやスキルなどのテンプレートファイルを最新バージョンに更新します。学習データ（進捗・履歴）はそのまま保持されます。",
    en: "Updates template files (rules, skills) to the latest version. Your learning data (progress, history) is preserved.",
  },
  "settings.setup.button": {
    ja: "セットアップを実行する",
    en: "Run Setup",
  },
  "settings.uninstall.title": {
    ja: "アンインストール手順",
    en: "Uninstall Guide",
  },
  "settings.uninstall.description": {
    ja: "アンインストール前に以下を実行してデータを消去してください。",
    en: "Run the following cleanup before uninstalling.",
  },
  "settings.uninstall.showDetails": {
    ja: "詳しく見る",
    en: "Show details",
  },
  "settings.uninstall.hideDetails": {
    ja: "閉じる",
    en: "Hide details",
  },
  "settings.uninstall.check.mentorFolder": {
    ja: ".mentor フォルダ",
    en: ".mentor folder",
  },
  "settings.uninstall.check.profile": {
    ja: "プロフィールデータ（拡張機能ストレージ）",
    en: "Profile data (extension storage)",
  },
  "settings.uninstall.check.claudeMdRef": {
    ja: "CLAUDE.md 内のメンター参照コード",
    en: "Mentor reference in CLAUDE.md",
  },
  "settings.uninstall.warning": {
    ja: "⚠ .mentor フォルダを削除すると学習履歴を含むすべてのデータが消去されます。フォルダを残しておけばいつでも再開できます。",
    en: "⚠ Deleting the .mentor folder will erase all data including learning history. Keep the folder to resume anytime.",
  },
  "settings.uninstall.cleanup": {
    ja: "データ消去",
    en: "Delete Data",
  },

  // No-config screen
  "app.noConfig.notFound": {
    ja: "が見つかりません。",
    en: "not found.",
  },
  "app.noConfig.instruction": {
    ja: '下のボタンをクリックするか、コマンドパレットから "Mentor Studio Code: Setup Mentor" を実行してください。',
    en: 'Click the button below, or run "Mentor Studio Code: Setup Mentor" from the command palette.',
  },
  "app.noConfig.button": {
    ja: "セットアップを実行する",
    en: "Run Setup",
  },
  "app.noConfig.hint": {
    ja: "* Setup Mentorを実行するとプロジェクトのルートディレクトリに .mentor フォルダが作成されます。また、メンター機能を利用するために必要な一文をCLAUDE.mdへ追加しますがプロジェクトのCLAUDE.mdに追加するか、個人のCLAUDE.mdに追加するか選択できます。",
    en: "* Running Setup Mentor creates a .mentor folder in your project root. It also adds a line to CLAUDE.md that's needed for the mentor feature — you can choose whether to add it to the project CLAUDE.md or your personal CLAUDE.md.",
  },

  // App-level
  "app.warning": { ja: "警告あり", en: "Has warnings" },
  "app.menu": { ja: "メニュー", en: "Menu" },
  "app.addTopicFailed": {
    ja: "トピックの追加に失敗しました",
    en: "Failed to add topic",
  },
  "app.deleteTopicFailed": {
    ja: "トピックの削除に失敗しました",
    en: "Failed to delete topic",
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
