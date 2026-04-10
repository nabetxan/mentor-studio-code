/**
 * Mentor CLI — データ永続化用 CLI ツールのソースコード（JavaScript 文字列）。
 *
 * セットアップ時に `.mentor/tools/mentor-cli.js` として書き出され、
 * メンターセッション中に AI が `node .mentor/tools/mentor-cli.js <command> [args]` で呼び出す。
 * 書き込み前にバックアップ (.bak) を作成し、書き込み後に JSON バリデーションを行う。
 *
 * ビルドツール不要でそのまま実行できる必要があるため、TypeScript モジュールではなく
 * プレーン JavaScript の文字列テンプレートとしてエクスポートしている。
 */
export const MENTOR_CLI_JS = `"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MENTOR_ROOT = path.resolve(__dirname, "..");
const HISTORY_PATH = path.join(MENTOR_ROOT, "question-history.json");
const PROGRESS_PATH = path.join(MENTOR_ROOT, "progress.json");
const CONFIG_PATH = path.join(MENTOR_ROOT, "config.json");

function ok(data) {
  console.log(JSON.stringify({ ok: true, ...data }));
  process.exit(0);
}

function fail(error) {
  console.log(JSON.stringify({ ok: false, error: String(error) }));
  process.exit(1);
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJSON(filePath, data) {
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, filePath + ".bak");
  }
  const content = JSON.stringify(data, null, 2) + "\\n";
  fs.writeFileSync(filePath, content);
  JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function generateId(existingIds) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 100; i++) {
    let id = "q_";
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 8; j++) {
      id += chars[bytes[j] % chars.length];
    }
    if (!existingIds.has(id)) return id;
  }
  throw new Error("Failed to generate unique ID");
}

const commands = {
  "record-question": function (argJson) {
    const input = JSON.parse(argJson);
    const required = ["taskId", "topic", "concept", "question", "userAnswer"];
    for (let k = 0; k < required.length; k++) {
      if (input[required[k]] === undefined) return fail("missing_field: " + required[k]);
    }
    if (typeof input.isCorrect !== "boolean") return fail("missing_field: isCorrect");
    const history = readJSON(HISTORY_PATH);
    const existingIds = new Set(history.history.map(function (e) { return e.id; }));
    const id = generateId(existingIds);
    history.history.push({
      id: id,
      reviewOf: input.reviewOf != null ? input.reviewOf : null,
      answeredAt: new Date().toISOString(),
      taskId: input.taskId,
      topic: input.topic,
      concept: input.concept,
      question: input.question,
      userAnswer: input.userAnswer,
      isCorrect: input.isCorrect
    });
    writeJSON(HISTORY_PATH, history);
    ok({ id: id });
  },

  "add-gap": function (argJson) {
    const input = JSON.parse(argJson);
    const required = ["questionId", "topic", "concept", "last_missed", "task", "note"];
    for (let k = 0; k < required.length; k++) {
      if (input[required[k]] === undefined) return fail("missing_field: " + required[k]);
    }
    const progress = readJSON(PROGRESS_PATH);
    if (progress.unresolved_gaps.some(function (g) { return g.questionId === input.questionId; })) {
      return fail("duplicate_questionId");
    }
    progress.unresolved_gaps.push({
      questionId: input.questionId,
      topic: input.topic,
      concept: input.concept,
      last_missed: input.last_missed,
      task: input.task,
      note: input.note
    });
    writeJSON(PROGRESS_PATH, progress);
    ok();
  },

  "remove-gap": function (questionId) {
    if (!questionId) return fail("missing_questionId");
    const progress = readJSON(PROGRESS_PATH);
    const before = progress.unresolved_gaps.length;
    progress.unresolved_gaps = progress.unresolved_gaps.filter(function (g) {
      return g.questionId !== questionId;
    });
    writeJSON(PROGRESS_PATH, progress);
    ok({ removed: progress.unresolved_gaps.length < before });
  },

  "update-gap": function (questionId, argJson) {
    if (!questionId) return fail("missing_questionId");
    const updates = JSON.parse(argJson);
    const progress = readJSON(PROGRESS_PATH);
    const gap = progress.unresolved_gaps.find(function (g) {
      return g.questionId === questionId;
    });
    if (!gap) return fail("gap_not_found");
    const allowed = ["last_missed", "note"];
    for (let i = 0; i < allowed.length; i++) {
      if (updates[allowed[i]] !== undefined) gap[allowed[i]] = updates[allowed[i]];
    }
    writeJSON(PROGRESS_PATH, progress);
    ok();
  },

  "update-progress": function (argJson) {
    const updates = JSON.parse(argJson);
    const progress = readJSON(PROGRESS_PATH);
    const allowed = ["current_plan", "current_task", "current_step", "next_suggest", "resume_context"];
    for (let i = 0; i < allowed.length; i++) {
      if (updates[allowed[i]] !== undefined) progress[allowed[i]] = updates[allowed[i]];
    }
    writeJSON(PROGRESS_PATH, progress);
    ok();
  },

  "add-completed-task": function (argJson) {
    const input = JSON.parse(argJson);
    const required = ["task", "name", "plan"];
    for (let k = 0; k < required.length; k++) {
      if (input[required[k]] === undefined) return fail("missing_field: " + required[k]);
    }
    const progress = readJSON(PROGRESS_PATH);
    progress.completed_tasks.push({ task: input.task, name: input.name, plan: input.plan });
    writeJSON(PROGRESS_PATH, progress);
    ok();
  },

  "add-skipped-task": function (argJson) {
    const input = JSON.parse(argJson);
    const required = ["task", "plan"];
    for (let k = 0; k < required.length; k++) {
      if (input[required[k]] === undefined) return fail("missing_field: " + required[k]);
    }
    const progress = readJSON(PROGRESS_PATH);
    progress.skipped_tasks.push({ task: input.task, plan: input.plan });
    writeJSON(PROGRESS_PATH, progress);
    ok();
  },

  "remove-skipped-task": function (task) {
    if (!task) return fail("missing_task");
    const progress = readJSON(PROGRESS_PATH);
    const before = progress.skipped_tasks.length;
    progress.skipped_tasks = progress.skipped_tasks.filter(function (s) {
      return s.task !== task;
    });
    writeJSON(PROGRESS_PATH, progress);
    ok({ removed: progress.skipped_tasks.length < before });
  },

  "update-profile": function (argJson) {
    const updates = JSON.parse(argJson);
    const progress = readJSON(PROGRESS_PATH);
    if (!updates.last_updated) {
      updates.last_updated = new Date().toISOString();
    }
    const profile = progress.learner_profile || {};
    const keys = Object.keys(updates);
    for (let i = 0; i < keys.length; i++) {
      profile[keys[i]] = updates[keys[i]];
    }
    progress.learner_profile = profile;
    writeJSON(PROGRESS_PATH, progress);
    ok();
  },

  "add-topic": function (argJson) {
    const input = JSON.parse(argJson);
    if (!input.key || !input.label) return fail("missing_field: key and label required");
    const config = readJSON(CONFIG_PATH);
    if (config.topics.some(function (t) { return t.key === input.key; })) {
      return fail("duplicate_key");
    }
    config.topics.push({ key: input.key, label: input.label });
    writeJSON(CONFIG_PATH, config);
    ok();
  },

  "list-topics": function () {
    const config = readJSON(CONFIG_PATH);
    ok({ topics: config.topics });
  },

  "update-config": function (argJson) {
    const updates = JSON.parse(argJson);
    const config = readJSON(CONFIG_PATH);
    const allowed = ["mentorFiles"];
    for (let i = 0; i < allowed.length; i++) {
      if (updates[allowed[i]] !== undefined) {
        if (typeof updates[allowed[i]] === "object" && typeof config[allowed[i]] === "object") {
          config[allowed[i]] = Object.assign({}, config[allowed[i]], updates[allowed[i]]);
        } else {
          config[allowed[i]] = updates[allowed[i]];
        }
      }
    }
    writeJSON(CONFIG_PATH, config);
    ok();
  }
};

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);
if (!command || !commands[command]) {
  fail("Unknown command: " + command + ". Available: " + Object.keys(commands).join(", "));
} else {
  try {
    commands[command].apply(null, rest);
  } catch (err) {
    fail(err.message);
  }
}
`;
