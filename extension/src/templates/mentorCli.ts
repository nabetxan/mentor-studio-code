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

  "session-brief": function (argJson) {
    var input = JSON.parse(argJson);
    var flow = input.flow;
    if (!flow) return fail("missing flow");
    var validFlows = ["mentor-session", "review", "comprehension-check", "implementation-review"];
    if (validFlows.indexOf(flow) === -1) return fail("Unknown flow: " + flow);
    var topic = input.topic || null;
    var progress = readJSON(PROGRESS_PATH);
    var profile = progress.learner_profile || {};
    var learner = {
      experience: profile.experience || "",
      level: profile.level || "",
      interests: profile.interests || [],
      weakAreas: profile.weak_areas || [],
      mentorStyle: profile.mentor_style || ""
    };

    if (flow === "mentor-session") {
      learner.lastUpdated = profile.last_updated || null;
      var allGaps = (progress.unresolved_gaps || []).slice();
      var currentTask = progress.current_task || null;
      var relevantGaps;
      if (topic) {
        relevantGaps = allGaps.filter(function (g) { return g.topic === topic; });
      } else if (currentTask) {
        relevantGaps = allGaps.filter(function (g) { return g.task === currentTask; });
        if (relevantGaps.length === 0 && allGaps.length > 0) {
          var fallback = allGaps.slice();
          fallback.sort(function (a, b) {
            var ta = a.last_missed || "";
            var tb = b.last_missed || "";
            return ta < tb ? -1 : ta > tb ? 1 : 0;
          });
          relevantGaps = fallback.slice(0, 5);
        }
      } else {
        relevantGaps = allGaps.slice();
        relevantGaps.sort(function (a, b) {
          var ta = a.last_missed || "";
          var tb = b.last_missed || "";
          return ta < tb ? -1 : ta > tb ? 1 : 0;
        });
        relevantGaps = relevantGaps.slice(0, 5);
      }
      var filteredCount = relevantGaps.length;
      relevantGaps.sort(function (a, b) {
        var ta = a.last_missed || "";
        var tb = b.last_missed || "";
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
      var mappedGaps = relevantGaps.map(function (g) {
        return {
          questionId: g.questionId,
          topic: g.topic,
          concept: g.concept,
          lastMissed: g.last_missed,
          task: g.task,
          note: g.note
        };
      });
      ok({
        flow: flow,
        learner: learner,
        resumeContext: progress.resume_context || null,
        currentTask: currentTask,
        relevantGaps: mappedGaps,
        gapCount: { total: allGaps.length, filtered: filteredCount }
      });
    } else if (flow === "review") {
      var reviewAllGaps = (progress.unresolved_gaps || []).slice();
      var gaps;
      if (topic) {
        gaps = reviewAllGaps.filter(function (g) { return g.topic === topic; });
      } else {
        gaps = reviewAllGaps.slice();
      }
      gaps.sort(function (a, b) {
        var ta = a.last_missed || "";
        var tb = b.last_missed || "";
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
      var mappedAllGaps = gaps.map(function (g) {
        return {
          questionId: g.questionId,
          topic: g.topic,
          concept: g.concept,
          lastMissed: g.last_missed,
          task: g.task,
          note: g.note
        };
      });
      ok({
        flow: flow,
        learner: learner,
        gaps: mappedAllGaps,
        gapCount: { total: reviewAllGaps.length, filtered: gaps.length }
      });
    } else if (flow === "comprehension-check") {
      var history = readJSON(HISTORY_PATH);
      var entries = history.history || [];
      var conceptCounts = {};
      var conceptOrder = [];
      for (var i = entries.length - 1; i >= 0; i--) {
        var e = entries[i];
        var key = e.topic + ":" + e.concept;
        if (!conceptCounts[key]) {
          conceptCounts[key] = { topic: e.topic, concept: e.concept, count: 0 };
          conceptOrder.push(key);
        }
      }
      for (var ci = 0; ci < entries.length; ci++) {
        var ck = entries[ci].topic + ":" + entries[ci].concept;
        if (conceptCounts[ck]) conceptCounts[ck].count++;
      }
      var concepts = conceptOrder.map(function (k) { return conceptCounts[k]; });
      var total = concepts.length;
      var capped = concepts.slice(0, 100);
      var topicSummary = {};
      for (var j = 0; j < entries.length; j++) {
        var t = entries[j].topic;
        if (!topicSummary[t]) topicSummary[t] = 0;
        topicSummary[t]++;
      }
      var config = readJSON(CONFIG_PATH);
      var ccResult = {
        flow: flow,
        learner: learner,
        coveredConcepts: capped,
        topicSummary: topicSummary,
        allTopics: (config.topics || []).map(function (t) { return t.key; })
      };
      if (total > 100) {
        ccResult.coveredConceptsTotal = total;
      }
      ok(ccResult);
    } else if (flow === "implementation-review") {
      ok({
        flow: flow,
        learner: learner,
        currentTask: progress.current_task || null,
        resumeContext: progress.resume_context || null
      });
    }
  },

  "list-unresolved": function (argJson) {
    var progress = readJSON(PROGRESS_PATH);
    var allGaps = progress.unresolved_gaps || [];
    var args = argJson ? JSON.parse(argJson) : {};
    var topic = args.topic;
    var filtered = topic
      ? allGaps.filter(function (g) { return g.topic === topic; })
      : allGaps;
    filtered = filtered.slice().sort(function (a, b) {
      return a.last_missed < b.last_missed ? -1 : 1;
    });
    var gaps = filtered.map(function (g) {
      return { questionId: g.questionId, topic: g.topic, concept: g.concept, lastMissed: g.last_missed, task: g.task, note: g.note };
    });
    ok({ gaps: gaps, gapCount: { total: allGaps.length, filtered: gaps.length } });
  },

  "get-history-by-ids": function (argJson) {
    var args = JSON.parse(argJson);
    var ids = args.ids;
    if (!ids || !Array.isArray(ids)) return fail("missing_field: ids (array)");
    var hist = readJSON(HISTORY_PATH);
    var all = hist.history || [];
    var idSet = {};
    for (var i = 0; i < ids.length; i++) idSet[ids[i]] = true;
    var entries = [];
    for (var j = 0; j < all.length; j++) {
      if (idSet[all[j].id]) {
        entries.push(all[j]);
        delete idSet[all[j].id];
      }
    }
    var notFound = Object.keys(idSet);
    ok({ entries: entries, notFound: notFound });
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
