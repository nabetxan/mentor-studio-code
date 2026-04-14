import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadSqlJs } from "../../src/db";
import {
  computeDashboardDataFromDb,
  dbAddTopic,
  dbDeleteTopics,
  dbMergeTopic,
  dbReadTopics,
  dbUpdateTopicLabel,
  parseMinimalProgress,
  topicIdToKey,
} from "../../src/services/dbDashboard";
import {
  makeEnvWithDb,
  seedPlans,
  seedQuestions,
  seedTasks,
  WASM,
} from "../cli/helpers";

async function openReadOnly(
  dbPath: string,
): Promise<import("sql.js").Database> {
  const SQL = await loadSqlJs(WASM);
  return new SQL.Database(readFileSync(dbPath));
}

describe("parseMinimalProgress", () => {
  it("extracts current_task and learner_profile.last_updated", () => {
    const raw = JSON.stringify({
      current_task: 42,
      learner_profile: { last_updated: "2026-04-13T00:00:00Z" },
    });
    const p = parseMinimalProgress(raw);
    expect(p.current_task).toBe(42);
    expect(p.learner_profile?.last_updated).toBe("2026-04-13T00:00:00Z");
  });

  it("returns null current_task when missing or wrong type", () => {
    expect(parseMinimalProgress("{}").current_task).toBeNull();
    expect(
      parseMinimalProgress('{"current_task":"3"}').current_task,
    ).toBeNull();
  });

  it("tolerates invalid JSON", () => {
    expect(parseMinimalProgress("not json").current_task).toBeNull();
  });
});

describe("computeDashboardDataFromDb", () => {
  it("computes expected dashboard from seeded DB", async () => {
    const env = await makeEnvWithDb([{ label: "JS" }, { label: "CSS" }]);
    await seedPlans(env.paths.dbPath, [
      {
        name: "Phase 1",
        status: "active",
        sortOrder: 1,
        createdAt: "2026-04-13T00:00:00Z",
      },
    ]);
    await seedTasks(env.paths.dbPath, [
      { planId: 1, name: "Setup", status: "completed", sortOrder: 1 },
      { planId: 1, name: "Build", status: "active", sortOrder: 2 },
    ]);
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "c1",
        question: "q1",
        userAnswer: "a",
        isCorrect: 1,
        lastAnsweredAt: "2026-04-12T00:00:00Z",
      },
      {
        topicId: 1,
        concept: "c2",
        question: "q2",
        userAnswer: "a",
        isCorrect: 0,
        note: "hint",
        lastAnsweredAt: "2026-04-13T00:00:00Z",
      },
      {
        topicId: 2,
        concept: "c3",
        question: "q3",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-11T00:00:00Z",
      },
    ]);

    const db = await openReadOnly(env.paths.dbPath);
    try {
      const out = computeDashboardDataFromDb(db, {
        current_task: 2,
        learner_profile: { last_updated: "2026-04-13T00:00:00Z" },
      });
      expect(out.totalQuestions).toBe(3);
      expect(out.correctRate).toBeCloseTo(1 / 3);
      expect(out.byTopic.map((t) => t.topic).sort()).toEqual(
        [topicIdToKey(1), topicIdToKey(2)].sort(),
      );
      expect(out.topicsWithHistory).toContain(topicIdToKey(1));
      expect(out.topicsWithHistory).toContain(topicIdToKey(2));
      expect(out.unresolvedGaps).toHaveLength(2);
      expect(out.completedTasks).toEqual([
        { task: "1", name: "Setup", plan: "Phase 1" },
      ]);
      expect(out.currentTask).toBe("Build");
      expect(out.profileLastUpdated).toBe("2026-04-13T00:00:00Z");
      expect(out.plans).toEqual([
        {
          id: 1,
          name: "Phase 1",
          filePath: null,
          status: "active",
          sortOrder: 1,
        },
      ]);
      expect(out.activePlan).toEqual({
        id: 1,
        name: "Phase 1",
        filePath: null,
        status: "active",
        sortOrder: 1,
      });
    } finally {
      db.close();
    }
  });

  it("returns empty-ish dashboard when DB has no data", async () => {
    const env = await makeEnvWithDb([]);
    const db = await openReadOnly(env.paths.dbPath);
    try {
      const out = computeDashboardDataFromDb(db, { current_task: null });
      expect(out.totalQuestions).toBe(0);
      expect(out.byTopic).toEqual([]);
      expect(out.topicsWithHistory).toEqual([]);
      expect(out.unresolvedGaps).toEqual([]);
      expect(out.completedTasks).toEqual([]);
      expect(out.currentTask).toBeNull();
      expect(out.plans).toEqual([]);
      expect(out.activePlan).toBeNull();
    } finally {
      db.close();
    }
  });

  it("returns all plans sorted by sortOrder with mixed statuses", async () => {
    const env = await makeEnvWithDb([]);
    await seedPlans(env.paths.dbPath, [
      {
        name: "Phase 2",
        filePath: "docs/p2.md",
        status: "queued",
        sortOrder: 2,
        createdAt: "2026-04-13T00:00:00Z",
      },
      {
        name: "Phase 1",
        filePath: "docs/p1.md",
        status: "completed",
        sortOrder: 1,
        createdAt: "2026-04-12T00:00:00Z",
      },
      {
        name: "Phase 3",
        status: "active",
        sortOrder: 3,
        createdAt: "2026-04-14T00:00:00Z",
      },
    ]);

    const db = await openReadOnly(env.paths.dbPath);
    try {
      const out = computeDashboardDataFromDb(db, { current_task: null });
      expect(out.plans.map((p) => p.name)).toEqual([
        "Phase 1",
        "Phase 2",
        "Phase 3",
      ]);
      expect(out.plans[0].filePath).toBe("docs/p1.md");
      expect(out.plans[2].filePath).toBeNull();
      expect(out.activePlan?.name).toBe("Phase 3");
      expect(out.activePlan?.status).toBe("active");
    } finally {
      db.close();
    }
  });
});

describe("DB topic ops", () => {
  it("addTopic inserts and returns synthetic key", async () => {
    const env = await makeEnvWithDb([]);
    const res = await dbAddTopic(env.paths.dbPath, "React", WASM);
    expect(res.ok).toBe(true);
    expect(res.key).toMatch(/^t_\d+$/);
    const topics = await dbReadTopics(env.paths.dbPath, WASM);
    expect(topics.map((t) => t.label)).toEqual(["React"]);
  });

  it("addTopic rejects duplicates", async () => {
    const env = await makeEnvWithDb([{ label: "JS" }]);
    const res = await dbAddTopic(env.paths.dbPath, "JS", WASM);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("duplicate_label");
  });

  it("updateTopicLabel renames", async () => {
    const env = await makeEnvWithDb([{ label: "JS" }]);
    const topics = await dbReadTopics(env.paths.dbPath, WASM);
    await dbUpdateTopicLabel(
      env.paths.dbPath,
      topics[0].key,
      "JavaScript",
      WASM,
    );
    const after = await dbReadTopics(env.paths.dbPath, WASM);
    expect(after[0].label).toBe("JavaScript");
  });

  it("mergeTopic moves questions and deletes source", async () => {
    const env = await makeEnvWithDb([{ label: "JS" }, { label: "JavaScript" }]);
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-13T00:00:00Z",
      },
    ]);
    await dbMergeTopic(
      env.paths.dbPath,
      topicIdToKey(1),
      topicIdToKey(2),
      WASM,
    );
    const topics = await dbReadTopics(env.paths.dbPath, WASM);
    expect(topics.map((t) => t.label)).toEqual(["JavaScript"]);
  });

  it("deleteTopics skips those referenced by questions", async () => {
    const env = await makeEnvWithDb([{ label: "JS" }, { label: "CSS" }]);
    await seedQuestions(env.paths.dbPath, [
      {
        topicId: 1,
        concept: "c",
        question: "q",
        userAnswer: "a",
        isCorrect: 0,
        lastAnsweredAt: "2026-04-13T00:00:00Z",
      },
    ]);
    const results = await dbDeleteTopics(
      env.paths.dbPath,
      [topicIdToKey(1), topicIdToKey(2)],
      WASM,
    );
    expect(results).toEqual([
      { key: topicIdToKey(1), ok: false, error: "has_related_data" },
      { key: topicIdToKey(2), ok: true },
    ]);
    const topics = await dbReadTopics(env.paths.dbPath, WASM);
    expect(topics.map((t) => t.label)).toEqual(["JS"]);
  });
});
