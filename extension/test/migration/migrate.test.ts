import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../../src/db/schema";
import { loadSqlJs } from "../../src/db/sqlJsLoader";
import { migrate } from "../../src/migration/migrate";

const WASM = join(__dirname, "..", "..", "dist", "sql-wasm.wasm");

function mkMentor(): string {
  const root = mkdtempSync(join(tmpdir(), "msc-migrate-"));
  const mentor = join(root, ".mentor");
  mkdirSync(mentor);
  return mentor;
}

function writeJson(path: string, obj: unknown): void {
  writeFileSync(path, JSON.stringify(obj, null, 2));
}

const baseConfig = {
  repositoryName: "demo",
  locale: "ja",
  enableMentor: true,
  topics: [
    { key: "a-js", label: "JavaScript" },
    { key: "c-react", label: "React" },
    { key: "a-css", label: "CSS" },
  ],
  mentorFiles: { spec: null, plan: "plans/phase-1.md" },
};

const baseProgress = {
  version: "1.0",
  current_plan: null,
  current_task: "t2",
  current_step: "s1",
  next_suggest: null,
  resume_context: "ctx",
  completed_tasks: [{ id: "t1", name: "T1", plan: "plans/phase-1.md" }],
  skipped_tasks: [{ id: "t3", name: "T3", plan: "plans/phase-1.md" }],
  unresolved_gaps: [{ questionId: "q2", note: "struggle" }],
  learner_profile: { name: "kaori" },
};

const baseHistory = {
  history: [
    {
      id: "q1",
      answeredAt: "2026-03-22T00:01:00Z",
      taskId: "t1",
      topic: "a-js",
      concept: "closures",
      question: "what is closure?",
      userAnswer: "fn",
      isCorrect: true,
    },
    {
      id: "q2",
      answeredAt: "2026-03-22T00:02:00Z",
      taskId: "t1",
      topic: "a-css",
      concept: "specificity",
      question: "?",
      userAnswer: "idk",
      isCorrect: false,
    },
    {
      id: "q3",
      answeredAt: "2026-03-22T00:03:00Z",
      taskId: "t2",
      topic: "unknown-topic",
      concept: "foo",
      question: "?",
      userAnswer: "bar",
      isCorrect: false,
    },
    {
      id: "q4",
      answeredAt: "2026-03-22T00:04:00Z",
      taskId: "t1",
      topic: "a-js",
      concept: "closures",
      question: "what is closure?",
      userAnswer: "correct",
      isCorrect: true,
      reviewOf: "q2",
    },
  ],
};

function seedFixture(
  mentor: string,
  overrides: {
    config?: unknown;
    progress?: unknown;
    history?: unknown;
  } = {},
): void {
  writeJson(join(mentor, "config.json"), overrides.config ?? baseConfig);
  writeJson(join(mentor, "progress.json"), overrides.progress ?? baseProgress);
  writeJson(
    join(mentor, "question-history.json"),
    overrides.history ?? baseHistory,
  );
}

describe("migrate", () => {
  it("migrates a fixture end-to-end successfully", async () => {
    const mentor = mkMentor();
    seedFixture(mentor);
    const result = await migrate(mentor, WASM);
    if (!result.ok)
      throw new Error(`migration failed: ${result.error} ${result.detail}`);

    expect(existsSync(join(mentor, "data.db"))).toBe(true);
    expect(existsSync(join(mentor, "question-history.json.bak"))).toBe(true);
    expect(existsSync(join(mentor, "progress.json.bak"))).toBe(true);
    expect(existsSync(join(mentor, "config.json.bak"))).toBe(true);

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(join(mentor, "data.db")));
    // topics: 3 known + 1 unknown-topic = 4
    expect(Number(db.exec("SELECT COUNT(*) FROM topics")[0].values[0][0])).toBe(
      4,
    );
    // questions: 4 entries - 1 reviewOf merged = 3
    expect(
      Number(db.exec("SELECT COUNT(*) FROM questions")[0].values[0][0]),
    ).toBe(3);
    // q2 must have note "struggle" from unresolved_gaps
    const noted = db.exec(
      "SELECT note, isCorrect FROM questions WHERE note = 'struggle'",
    );
    expect(noted[0].values).toHaveLength(1);
    // tasks: t1 (completed) + t3 (skipped) + t2 placeholder in Legacy plan = 3
    expect(Number(db.exec("SELECT COUNT(*) FROM tasks")[0].values[0][0])).toBe(
      3,
    );
    // PRAGMA user_version
    expect(Number(db.exec("PRAGMA user_version")[0].values[0][0])).toBe(
      SCHEMA_VERSION,
    );
    db.close();

    const newProgress = JSON.parse(
      readFileSync(join(mentor, "progress.json"), "utf-8"),
    );
    expect(newProgress).not.toHaveProperty("unresolved_gaps");
    expect(newProgress).not.toHaveProperty("completed_tasks");
    expect(newProgress).not.toHaveProperty("version");
    expect(typeof newProgress.current_task).toBe("number");
    expect(newProgress.learner_profile).toEqual({ name: "kaori" });

    const newConfig = JSON.parse(
      readFileSync(join(mentor, "config.json"), "utf-8"),
    );
    expect(newConfig).not.toHaveProperty("topics");
    expect(newConfig.mentorFiles).not.toHaveProperty("plan");
    expect(newConfig.mentorFiles).toHaveProperty("spec");
  });

  it("handles mixed legacy task entries: strings + objects with 'task' field", async () => {
    const mentor = mkMentor();
    seedFixture(mentor, {
      config: { ...baseConfig, mentorFiles: { spec: null, plan: null } },
      progress: {
        ...baseProgress,
        completed_tasks: [
          "Task 1: pre-schema string entry",
          "Task 2: another string",
          { task: "t1", name: "T1", plan: "plans/phase-1.md" },
        ],
        skipped_tasks: ["Old skipped string"],
        current_task: null,
      },
      history: { history: [] },
    });
    const result = await migrate(mentor, WASM);
    if (!result.ok)
      throw new Error(`migration failed: ${result.error} ${result.detail}`);

    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(join(mentor, "data.db")));
    const tasks = db.exec("SELECT name, status FROM tasks ORDER BY id")[0]
      .values;
    expect(tasks).toEqual([
      ["T1", "completed"],
      ["Task 1: pre-schema string entry", "completed"],
      ["Task 2: another string", "completed"],
      ["Old skipped string", "skipped"],
    ]);
    const legacy = db.exec(
      "SELECT COUNT(*) FROM plans WHERE name='Legacy' AND filePath IS NULL",
    )[0].values[0][0];
    expect(Number(legacy)).toBe(1);
    db.close();
  });

  it("extracts plan name from first-line heading of real file (default reader)", async () => {
    const mentor = mkMentor();
    const workspace = join(mentor, "..");
    mkdirSync(join(workspace, "plans"));
    writeFileSync(
      join(workspace, "plans", "phase-1.md"),
      "# Phase 1: Bootstrap\n\nbody\n",
    );
    seedFixture(mentor);
    const result = await migrate(mentor, WASM);
    if (!result.ok)
      throw new Error(`migration failed: ${result.error} ${result.detail}`);
    const SQL = await loadSqlJs(WASM);
    const db = new SQL.Database(readFileSync(join(mentor, "data.db")));
    const planName = db.exec(
      "SELECT name FROM plans WHERE filePath = 'plans/phase-1.md'",
    )[0].values[0][0];
    expect(planName).toBe("Phase 1: Bootstrap");
    db.close();
  });

  it("returns legacy_read_failed when a legacy JSON file is malformed", async () => {
    const mentor = mkMentor();
    writeJson(join(mentor, "config.json"), baseConfig);
    writeJson(join(mentor, "progress.json"), baseProgress);
    writeFileSync(join(mentor, "question-history.json"), "{ not json", "utf-8");
    const result = await migrate(mentor, WASM);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("legacy_read_failed");
  });

  it("rolls back and deletes data.db if migration throws mid-transaction", async () => {
    const mentor = mkMentor();
    // Use a readPlanFileHeading that throws during the transaction to force
    // the migration rollback path (data.db deleted, backups preserved).
    seedFixture(mentor);
    const result = await migrate(mentor, WASM, {
      readPlanFileHeading: () =>
        Promise.reject(new Error("simulated_heading_read_failure")),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("migration_failed");
    expect(existsSync(join(mentor, "data.db"))).toBe(false);
    // Backups still exist
    expect(existsSync(join(mentor, "question-history.json.bak"))).toBe(true);
  });
});
