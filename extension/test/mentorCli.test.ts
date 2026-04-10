/// <reference types="node" />
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MENTOR_CLI_JS } from "../src/templates/mentorCli";

const TMP_ROOT = join(__dirname, ".tmp-cli-test");
const MENTOR_DIR = join(TMP_ROOT, ".mentor");
const TOOLS_DIR = join(MENTOR_DIR, "tools");
const CLI_PATH = join(TOOLS_DIR, "mentor-cli.js");

function setupFixtures(): void {
  rmSync(TMP_ROOT, { recursive: true, force: true });
  mkdirSync(TOOLS_DIR, { recursive: true });
  writeFileSync(CLI_PATH, MENTOR_CLI_JS);
  writeFileSync(
    join(MENTOR_DIR, "question-history.json"),
    JSON.stringify({ history: [] }, null, 2) + "\n",
  );
  writeFileSync(
    join(MENTOR_DIR, "progress.json"),
    JSON.stringify(
      {
        version: "1.0",
        current_plan: null,
        current_task: null,
        current_step: null,
        next_suggest: null,
        resume_context: null,
        completed_tasks: [],
        skipped_tasks: [],
        unresolved_gaps: [],
        learner_profile: {
          experience: "",
          level: "",
          interests: [],
          weak_areas: [],
          mentor_style: "",
          last_updated: null,
        },
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(MENTOR_DIR, "config.json"),
    JSON.stringify(
      {
        repositoryName: "test",
        enableMentor: true,
        topics: [{ key: "a-react", label: "React" }],
        mentorFiles: { spec: null, plan: null },
        locale: "en",
      },
      null,
      2,
    ) + "\n",
  );
}

function run(
  command: string,
  ...args: string[]
): { ok: boolean; [key: string]: unknown } {
  try {
    const stdout = execFileSync("node", [CLI_PATH, command, ...args], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return JSON.parse(stdout) as { ok: boolean; [key: string]: unknown };
  } catch (err: unknown) {
    // CLI uses process.exit(1) for errors — parse stdout from the error
    const stdout = (err as { stdout?: string }).stdout?.trim();
    if (stdout) {
      return JSON.parse(stdout) as { ok: boolean; [key: string]: unknown };
    }
    throw err;
  }
}

function readFixture(filename: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(MENTOR_DIR, filename), "utf-8"),
  ) as Record<string, unknown>;
}

describe("mentor-cli", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => rmSync(TMP_ROOT, { recursive: true, force: true }));

  describe("record-question", () => {
    it("appends entry with auto-generated ID", () => {
      const input = JSON.stringify({
        taskId: "task1",
        topic: "a-react",
        concept: "hooks",
        question: "What is useState?",
        userAnswer: "state management",
        isCorrect: true,
        reviewOf: null,
      });
      const result = run("record-question", input);
      expect(result.ok).toBe(true);
      expect(result.id).toMatch(/^q_[a-zA-Z0-9]{8}$/);

      const history = readFixture("question-history.json") as {
        history: { id: string }[];
      };
      expect(history.history).toHaveLength(1);
      expect(history.history[0].id).toBe(result.id);
    });

    it("creates backup file", () => {
      const input = JSON.stringify({
        taskId: "task1",
        topic: "a-react",
        concept: "hooks",
        question: "Q?",
        userAnswer: "A",
        isCorrect: true,
      });
      run("record-question", input);
      expect(existsSync(join(MENTOR_DIR, "question-history.json.bak"))).toBe(
        true,
      );
    });

    it("fails on missing required field", () => {
      const input = JSON.stringify({ taskId: "task1" });
      const result = run("record-question", input);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("missing_field");
    });

    it("handles special characters in userAnswer", () => {
      const input = JSON.stringify({
        taskId: "task1",
        topic: "a-react",
        concept: "hooks",
        question: "What's useState?",
        userAnswer: 'It\'s for state management — uses "quotes" and 日本語',
        isCorrect: true,
      });
      const result = run("record-question", input);
      expect(result.ok).toBe(true);

      const history = readFixture("question-history.json") as {
        history: { userAnswer: string }[];
      };
      expect(history.history[0].userAnswer).toContain("日本語");
    });
  });

  describe("add-gap / remove-gap", () => {
    it("adds and removes an unresolved gap", () => {
      const gap = JSON.stringify({
        questionId: "q_test1234",
        topic: "a-react",
        concept: "hooks",
        last_missed: "2026-01-01T00:00:00Z",
        task: "task1",
        note: "misunderstood hooks",
      });
      expect(run("add-gap", gap).ok).toBe(true);

      const progress = readFixture("progress.json") as {
        unresolved_gaps: unknown[];
      };
      expect(progress.unresolved_gaps).toHaveLength(1);

      expect(run("remove-gap", "q_test1234").ok).toBe(true);
      const after = readFixture("progress.json") as {
        unresolved_gaps: unknown[];
      };
      expect(after.unresolved_gaps).toHaveLength(0);
    });

    it("rejects duplicate questionId", () => {
      const gap = JSON.stringify({
        questionId: "q_dup12345",
        topic: "a-react",
        concept: "c",
        last_missed: "2026-01-01T00:00:00Z",
        task: "t",
        note: "n",
      });
      run("add-gap", gap);
      const result = run("add-gap", gap);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("duplicate_questionId");
    });
  });

  describe("update-gap", () => {
    it("updates last_missed on existing gap", () => {
      const gap = JSON.stringify({
        questionId: "q_upd12345",
        topic: "a-react",
        concept: "c",
        last_missed: "2026-01-01T00:00:00Z",
        task: "t",
        note: "n",
      });
      run("add-gap", gap);
      const update = JSON.stringify({ last_missed: "2026-06-01T00:00:00Z" });
      expect(run("update-gap", "q_upd12345", update).ok).toBe(true);

      const progress = readFixture("progress.json") as {
        unresolved_gaps: { last_missed: string }[];
      };
      expect(progress.unresolved_gaps[0].last_missed).toBe(
        "2026-06-01T00:00:00Z",
      );
    });

    it("fails for non-existent gap", () => {
      const update = JSON.stringify({ last_missed: "2026-06-01T00:00:00Z" });
      const result = run("update-gap", "q_nonexist", update);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("gap_not_found");
    });
  });

  describe("update-progress", () => {
    it("merges allowed fields only", () => {
      const updates = JSON.stringify({
        current_step: "Task 1 done",
        resume_context: "Next: Task 2",
        version: "should_not_change",
      });
      run("update-progress", updates);
      const progress = readFixture("progress.json") as Record<string, unknown>;
      expect(progress.current_step).toBe("Task 1 done");
      expect(progress.resume_context).toBe("Next: Task 2");
      expect(progress.version).toBe("1.0");
    });
  });

  describe("add-completed-task", () => {
    it("appends to completed_tasks", () => {
      const task = JSON.stringify({
        task: "1",
        name: "Setup",
        plan: "plan.md",
      });
      expect(run("add-completed-task", task).ok).toBe(true);
      const progress = readFixture("progress.json") as {
        completed_tasks: unknown[];
      };
      expect(progress.completed_tasks).toHaveLength(1);
    });
  });

  describe("skipped tasks", () => {
    it("adds and removes skipped tasks", () => {
      const task = JSON.stringify({ task: "skip1", plan: "plan.md" });
      run("add-skipped-task", task);
      const progress = readFixture("progress.json") as {
        skipped_tasks: unknown[];
      };
      expect(progress.skipped_tasks).toHaveLength(1);

      run("remove-skipped-task", "skip1");
      const after = readFixture("progress.json") as {
        skipped_tasks: unknown[];
      };
      expect(after.skipped_tasks).toHaveLength(0);
    });
  });

  describe("update-profile", () => {
    it("merges profile fields and auto-sets last_updated", () => {
      const updates = JSON.stringify({
        level: "intermediate",
        weak_areas: ["backend"],
      });
      run("update-profile", updates);
      const progress = readFixture("progress.json") as {
        learner_profile: {
          level: string;
          weak_areas: string[];
          last_updated: string;
        };
      };
      expect(progress.learner_profile.level).toBe("intermediate");
      expect(progress.learner_profile.weak_areas).toEqual(["backend"]);
      expect(progress.learner_profile.last_updated).toBeTruthy();
    });
  });

  describe("add-topic / list-topics", () => {
    it("adds a new topic and lists all", () => {
      const topic = JSON.stringify({ key: "a-css", label: "CSS" });
      expect(run("add-topic", topic).ok).toBe(true);

      const result = run("list-topics") as {
        ok: boolean;
        topics: { key: string }[];
      };
      expect(result.ok).toBe(true);
      expect(result.topics).toHaveLength(2);
      expect(result.topics[1].key).toBe("a-css");
    });

    it("rejects duplicate key", () => {
      const topic = JSON.stringify({ key: "a-react", label: "React Dup" });
      const result = run("add-topic", topic);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("duplicate_key");
    });
  });

  describe("update-config", () => {
    it("merges mentorFiles fields", () => {
      const updates = JSON.stringify({
        mentorFiles: { plan: "docs/plan.md" },
      });
      expect(run("update-config", updates).ok).toBe(true);
      const config = readFixture("config.json") as {
        mentorFiles: { spec: string | null; plan: string | null };
      };
      expect(config.mentorFiles.plan).toBe("docs/plan.md");
      expect(config.mentorFiles.spec).toBeNull();
    });
  });

  describe("unknown command", () => {
    it("returns error for unknown command", () => {
      const result = run("nonexistent") as {
        ok: boolean;
        error: string;
      };
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Unknown command");
    });
  });

  describe("error paths", () => {
    it("fails gracefully when question-history.json is missing", () => {
      rmSync(join(MENTOR_DIR, "question-history.json"));
      const input = JSON.stringify({
        taskId: "task1",
        topic: "a-react",
        concept: "hooks",
        question: "Q?",
        userAnswer: "A",
        isCorrect: true,
      });
      const result = run("record-question", input);
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("fails gracefully when progress.json is missing", () => {
      rmSync(join(MENTOR_DIR, "progress.json"));
      const input = JSON.stringify({
        questionId: "q_test1234",
        topic: "a-react",
        concept: "hooks",
        last_missed: "2026-01-01T00:00:00Z",
        task: "task1",
        note: "n",
      });
      const result = run("add-gap", input);
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("fails gracefully when config.json is missing", () => {
      rmSync(join(MENTOR_DIR, "config.json"));
      const result = run("list-topics");
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("fails gracefully when question-history.json contains invalid JSON", () => {
      writeFileSync(join(MENTOR_DIR, "question-history.json"), "{ broken json");
      const input = JSON.stringify({
        taskId: "task1",
        topic: "a-react",
        concept: "hooks",
        question: "Q?",
        userAnswer: "A",
        isCorrect: true,
      });
      const result = run("record-question", input);
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("fails gracefully when progress.json contains invalid JSON", () => {
      writeFileSync(join(MENTOR_DIR, "progress.json"), "not-json!!!");
      const updates = JSON.stringify({ current_step: "test" });
      const result = run("update-progress", updates);
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("fails gracefully when config.json contains invalid JSON", () => {
      writeFileSync(join(MENTOR_DIR, "config.json"), "{{{");
      const topic = JSON.stringify({ key: "a-css", label: "CSS" });
      const result = run("add-topic", topic);
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("fails gracefully when command argument is invalid JSON", () => {
      const result = run("record-question", "not-json");
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
