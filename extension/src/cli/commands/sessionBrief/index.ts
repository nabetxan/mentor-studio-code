import { existsSync, readFileSync } from "node:fs";
import type { Database } from "sql.js";

import { loadSqlJs, parseJsonStringArray } from "../../../db";
import { narrowTopicId } from "../narrow";
import type { Command, CommandResult } from "../types";
import { comprehensionCheckBrief } from "./comprehensionCheck";
import { implementationReviewBrief } from "./implementationReview";
import { mapLearner, type DbProfileInput, type Flow } from "./learner";
import { mentorSessionBrief } from "./mentorSession";
import { reviewBrief } from "./review";

const FLOWS: readonly Flow[] = [
  "mentor-session",
  "review",
  "comprehension-check",
  "implementation-review",
] as const;

function isFlow(value: unknown): value is Flow {
  return (
    typeof value === "string" && (FLOWS as readonly string[]).includes(value)
  );
}

function readDbProfile(db: Database): DbProfileInput {
  const res = db.exec(
    `SELECT experience, level, interests, weakAreas, mentorStyle, lastUpdated
     FROM learner_profile
     ORDER BY lastUpdated DESC, id DESC
     LIMIT 1`,
  )[0];
  if (!res || res.values.length === 0) {
    return {
      experience: "",
      level: "",
      interests: [],
      weakAreas: [],
      mentorStyle: "",
      lastUpdated: null,
    };
  }
  const [exp, lvl, inter, weak, style, lu] = res.values[0];
  return {
    experience: String(exp ?? ""),
    level: String(lvl ?? ""),
    interests: parseJsonStringArray(inter),
    weakAreas: parseJsonStringArray(weak),
    mentorStyle: String(style ?? ""),
    lastUpdated: lu === null || lu === undefined ? null : String(lu),
  };
}

function readResumeContext(db: Database): string | null {
  const res = db.exec(
    "SELECT value FROM app_state WHERE key='resume_context'",
  )[0];
  if (!res || res.values.length === 0) return null;
  const v = res.values[0][0];
  return v === null || v === undefined ? null : String(v);
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

  const SQL = await loadSqlJs();
  const db = new SQL.Database(readFileSync(paths.dbPath));
  try {
    const dbProfile = readDbProfile(db);
    const learner = mapLearner(dbProfile, flow);
    const resumeContext = readResumeContext(db);
    return runFlow(db, flow, learner, resumeContext, topicId.value);
  } finally {
    db.close();
  }
};

function runFlow(
  db: Database,
  flow: Flow,
  learner: ReturnType<typeof mapLearner>,
  resumeContext: string | null,
  topicId: number | undefined,
): CommandResult {
  switch (flow) {
    case "mentor-session":
      return {
        ok: true,
        flow,
        learner,
        ...mentorSessionBrief(db, resumeContext),
      };
    case "review":
      return { ok: true, flow, learner, ...reviewBrief(db, topicId) };
    case "comprehension-check":
      return { ok: true, flow, learner, ...comprehensionCheckBrief(db) };
    case "implementation-review":
      return {
        ok: true,
        flow,
        learner,
        ...implementationReviewBrief(db, resumeContext),
      };
  }
}
