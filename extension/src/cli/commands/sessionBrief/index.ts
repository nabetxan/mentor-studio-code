import { existsSync, readFileSync } from "node:fs";

import { loadSqlJs } from "../../../db";
import { narrowTopicId } from "../narrow";
import type { Command, CommandResult } from "../types";
import { comprehensionCheckBrief } from "./comprehensionCheck";
import { implementationReviewBrief } from "./implementationReview";
import { mapLearner, type Flow } from "./learner";
import { mentorSessionBrief } from "./mentorSession";
import { reviewBrief } from "./review";

const FLOWS: readonly Flow[] = [
  "mentor-session",
  "review",
  "comprehension-check",
  "implementation-review",
] as const;

const DEFAULT_PROGRESS: Record<string, unknown> = {
  learner_profile: {},
  resume_context: null,
};

function isFlow(value: unknown): value is Flow {
  return (
    typeof value === "string" && (FLOWS as readonly string[]).includes(value)
  );
}

type ProgressLoad =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; detail: string };

function loadProgress(progressPath: string): ProgressLoad {
  if (!existsSync(progressPath)) return { ok: true, value: DEFAULT_PROGRESS };
  const raw = readFileSync(progressPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: true, value: {} };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

export const sessionBrief: Command = async (rawArgs, paths) => {
  const args = (rawArgs ?? {}) as { flow?: unknown; topicId?: unknown };
  if (!isFlow(args.flow)) return { ok: false, error: "invalid_flow" };
  const flow = args.flow;

  const topicId = narrowTopicId(args.topicId);
  if (!topicId.ok) {
    return { ok: false, error: "invalid_args", detail: topicId.error };
  }

  if (!existsSync(paths.dbPath)) return { ok: false, error: "db_missing" };

  const progress = loadProgress(paths.progressPath);
  if (!progress.ok) {
    return { ok: false, error: "invalid_json", detail: progress.detail };
  }
  const profile = (progress.value.learner_profile ?? {}) as Record<
    string,
    unknown
  >;
  const learner = mapLearner(profile, flow);

  const SQL = await loadSqlJs(paths.wasmPath);
  const db = new SQL.Database(readFileSync(paths.dbPath));
  try {
    return runFlow(db, flow, learner, progress.value, topicId.value);
  } finally {
    db.close();
  }
};

function runFlow(
  db: import("sql.js").Database,
  flow: Flow,
  learner: ReturnType<typeof mapLearner>,
  progress: Record<string, unknown>,
  topicId: number | undefined,
): CommandResult {
  switch (flow) {
    case "mentor-session":
      return { ok: true, flow, learner, ...mentorSessionBrief(db, progress) };
    case "review":
      return { ok: true, flow, learner, ...reviewBrief(db, topicId) };
    case "comprehension-check":
      return { ok: true, flow, learner, ...comprehensionCheckBrief(db) };
    case "implementation-review":
      return {
        ok: true,
        flow,
        learner,
        ...implementationReviewBrief(db, progress),
      };
  }
}
