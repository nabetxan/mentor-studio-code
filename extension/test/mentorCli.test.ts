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

// Phase 2 Task P2-5-3 で削除予定。MENTOR_CLI_JS テンプレは廃止
describe.skip("mentor-cli", () => {
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

  describe("session-brief", () => {
    describe("error cases", () => {
      it("fails when flow is missing", () => {
        const result = run("session-brief", JSON.stringify({}));
        expect(result.ok).toBe(false);
        expect(result.error).toBe("missing flow");
      });

      it("fails for unknown flow", () => {
        const result = run("session-brief", JSON.stringify({ flow: "banana" }));
        expect(result.ok).toBe(false);
        expect(result.error).toBe("Unknown flow: banana");
      });
    });

    describe("mentor-session flow", () => {
      it("returns learner profile with lastUpdated", () => {
        // Set up profile
        run(
          "update-profile",
          JSON.stringify({
            level: "intermediate",
            weak_areas: ["testing"],
            mentor_style: "socratic",
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "mentor-session" }),
        );
        expect(result.ok).toBe(true);
        const learner = result.learner as Record<string, unknown>;
        expect(learner.level).toBe("intermediate");
        expect(learner.weakAreas).toEqual(["testing"]);
        expect(learner.mentorStyle).toBe("socratic");
        expect(learner).toHaveProperty("lastUpdated");
        expect(learner.lastUpdated).toBeTruthy();
        expect(result.flow).toBe("mentor-session");
      });

      it("filters gaps by topic when topic is provided", () => {
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_react001",
            topic: "a-react",
            concept: "hooks",
            last_missed: "2026-01-01T00:00:00Z",
            task: "task1",
            note: "hooks gap",
          }),
        );
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_css00001",
            topic: "a-css",
            concept: "flexbox",
            last_missed: "2026-01-02T00:00:00Z",
            task: "task1",
            note: "css gap",
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "mentor-session", topic: "a-react" }),
        );
        expect(result.ok).toBe(true);
        const gaps = result.relevantGaps as Array<Record<string, unknown>>;
        expect(gaps).toHaveLength(1);
        expect(gaps[0].topic).toBe("a-react");
        expect(gaps[0].questionId).toBe("q_react001");
        expect(gaps[0].lastMissed).toBe("2026-01-01T00:00:00Z");
        expect(result.gapCount).toEqual({ total: 2, filtered: 1 });
        expect(result.flow).toBe("mentor-session");
      });

      it("does not cap topic-filtered gaps and reports correct filtered count", () => {
        // Create 7 gaps all matching the same topic
        for (let i = 0; i < 7; i++) {
          run(
            "add-gap",
            JSON.stringify({
              questionId: `q_tp${String(i).padStart(6, "0")}`,
              topic: "a-react",
              concept: `concept${i}`,
              last_missed: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
              task: `task${i}`,
              note: `gap ${i}`,
            }),
          );
        }
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "mentor-session", topic: "a-react" }),
        );
        expect(result.ok).toBe(true);
        const gaps = result.relevantGaps as Array<Record<string, unknown>>;
        expect(gaps).toHaveLength(7);
        expect(result.gapCount).toEqual({ total: 7, filtered: 7 });
      });

      it("filters gaps by current_task when no topic provided", () => {
        run("update-progress", JSON.stringify({ current_task: "task2" }));
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_t1gap001",
            topic: "a-react",
            concept: "hooks",
            last_missed: "2026-01-01T00:00:00Z",
            task: "task1",
            note: "task1 gap",
          }),
        );
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_t2gap001",
            topic: "a-react",
            concept: "state",
            last_missed: "2026-01-02T00:00:00Z",
            task: "task2",
            note: "task2 gap",
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "mentor-session" }),
        );
        expect(result.ok).toBe(true);
        const gaps = result.relevantGaps as Array<Record<string, unknown>>;
        expect(gaps).toHaveLength(1);
        expect(gaps[0].task).toBe("task2");
        expect(result.currentTask).toBe("task2");
        expect(result.flow).toBe("mentor-session");
      });

      it("falls back to top 5 when currentTask is set but no gaps match it", () => {
        run(
          "update-progress",
          JSON.stringify({ current_task: "task-nonexistent" }),
        );
        for (let i = 0; i < 7; i++) {
          run(
            "add-gap",
            JSON.stringify({
              questionId: `q_ft${String(i).padStart(6, "0")}`,
              topic: "a-react",
              concept: `concept${i}`,
              last_missed: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
              task: `task${i}`,
              note: `gap ${i}`,
            }),
          );
        }
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "mentor-session" }),
        );
        expect(result.ok).toBe(true);
        const gaps = result.relevantGaps as Array<Record<string, unknown>>;
        expect(gaps).toHaveLength(5);
        expect(gaps[0].lastMissed).toBe("2026-01-01T00:00:00Z");
        expect(gaps[4].lastMissed).toBe("2026-01-05T00:00:00Z");
        expect(result.gapCount).toEqual({ total: 7, filtered: 5 });
        expect(result.currentTask).toBe("task-nonexistent");
        expect(result.flow).toBe("mentor-session");
      });

      it("falls back to top 5 gaps sorted by last_missed ascending", () => {
        // No topic, no current_task -> fallback
        for (let i = 0; i < 7; i++) {
          run(
            "add-gap",
            JSON.stringify({
              questionId: `q_fb${String(i).padStart(6, "0")}`,
              topic: "a-react",
              concept: `concept${i}`,
              last_missed: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
              task: `task${i}`,
              note: `gap ${i}`,
            }),
          );
        }
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "mentor-session" }),
        );
        expect(result.ok).toBe(true);
        const gaps = result.relevantGaps as Array<Record<string, unknown>>;
        expect(gaps).toHaveLength(5);
        // Sorted ascending: earliest last_missed first
        expect(gaps[0].lastMissed).toBe("2026-01-01T00:00:00Z");
        expect(gaps[4].lastMissed).toBe("2026-01-05T00:00:00Z");
        expect(result.gapCount).toEqual({ total: 7, filtered: 5 });
        expect(result.flow).toBe("mentor-session");
      });

      it("returns resumeContext and currentTask", () => {
        run(
          "update-progress",
          JSON.stringify({
            current_task: "task3",
            resume_context: "Working on auth module",
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "mentor-session" }),
        );
        expect(result.ok).toBe(true);
        expect(result.resumeContext).toBe("Working on auth module");
        expect(result.currentTask).toBe("task3");
        expect(result.flow).toBe("mentor-session");
      });
    });

    describe("review flow", () => {
      it("returns all gaps sorted by last_missed ascending", () => {
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_rev00001",
            topic: "a-react",
            concept: "hooks",
            last_missed: "2026-03-01T00:00:00Z",
            task: "task1",
            note: "recent",
          }),
        );
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_rev00002",
            topic: "a-css",
            concept: "grid",
            last_missed: "2026-01-01T00:00:00Z",
            task: "task1",
            note: "old",
          }),
        );
        const result = run("session-brief", JSON.stringify({ flow: "review" }));
        expect(result.ok).toBe(true);
        const gaps = result.gaps as Array<Record<string, unknown>>;
        expect(gaps).toHaveLength(2);
        // Sorted ascending: oldest first
        expect(gaps[0].lastMissed).toBe("2026-01-01T00:00:00Z");
        expect(gaps[1].lastMissed).toBe("2026-03-01T00:00:00Z");
        expect(result.gapCount).toEqual({ total: 2, filtered: 2 });
        expect(result.flow).toBe("review");
      });

      it("filters gaps by topic when provided", () => {
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_rvt00001",
            topic: "a-react",
            concept: "hooks",
            last_missed: "2026-01-01T00:00:00Z",
            task: "task1",
            note: "react gap",
          }),
        );
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_rvt00002",
            topic: "a-css",
            concept: "grid",
            last_missed: "2026-01-02T00:00:00Z",
            task: "task1",
            note: "css gap",
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "review", topic: "a-css" }),
        );
        expect(result.ok).toBe(true);
        const gaps = result.gaps as Array<Record<string, unknown>>;
        expect(gaps).toHaveLength(1);
        expect(gaps[0].topic).toBe("a-css");
        expect(result.gapCount).toEqual({ total: 2, filtered: 1 });
        expect(result.flow).toBe("review");
      });

      it("returns learner profile without lastUpdated", () => {
        run("update-profile", JSON.stringify({ level: "beginner" }));
        const result = run("session-brief", JSON.stringify({ flow: "review" }));
        expect(result.ok).toBe(true);
        const learner = result.learner as Record<string, unknown>;
        expect(learner.level).toBe("beginner");
        expect(learner).not.toHaveProperty("lastUpdated");
        expect(result.flow).toBe("review");
      });
    });

    describe("comprehension-check flow", () => {
      it("aggregates unique topic+concept pairs from history", () => {
        // Record some questions
        run(
          "record-question",
          JSON.stringify({
            taskId: "task1",
            topic: "a-react",
            concept: "hooks",
            question: "Q1?",
            userAnswer: "A1",
            isCorrect: true,
          }),
        );
        run(
          "record-question",
          JSON.stringify({
            taskId: "task1",
            topic: "a-react",
            concept: "hooks",
            question: "Q2?",
            userAnswer: "A2",
            isCorrect: false,
          }),
        );
        run(
          "record-question",
          JSON.stringify({
            taskId: "task1",
            topic: "a-react",
            concept: "state",
            question: "Q3?",
            userAnswer: "A3",
            isCorrect: true,
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "comprehension-check" }),
        );
        expect(result.ok).toBe(true);
        const concepts = result.coveredConcepts as Array<
          Record<string, unknown>
        >;
        // 2 unique pairs: react+hooks and react+state
        expect(concepts).toHaveLength(2);
        // Most recently asked first (state was last, hooks before)
        expect(concepts[0].concept).toBe("state");
        expect(concepts[0].count).toBe(1);
        expect(concepts[1].concept).toBe("hooks");
        expect(concepts[1].count).toBe(2);
        expect(result.flow).toBe("comprehension-check");
      });

      it("caps coveredConcepts at 100 and includes total", () => {
        // Create 105 unique topic+concept entries with minimal field sizes
        const history = {
          history: Array.from({ length: 105 }, (_, i) => ({
            id: `q_${i}`,
            reviewOf: null,
            answeredAt: "2026-01-01T00:00:00Z",
            taskId: "t",
            topic: `t${i}`,
            concept: `c${i}`,
            question: "Q",
            userAnswer: "A",
            isCorrect: true,
          })),
        };
        writeFileSync(
          join(MENTOR_DIR, "question-history.json"),
          JSON.stringify(history) + "\n",
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "comprehension-check" }),
        );
        expect(result.ok).toBe(true);
        const concepts = result.coveredConcepts as Array<
          Record<string, unknown>
        >;
        expect(concepts).toHaveLength(100);
        expect(result.coveredConceptsTotal).toBe(105);
        // Each entry should have a count field
        expect(concepts[0]).toHaveProperty("count");
        expect(result.flow).toBe("comprehension-check");
      });

      it("does not include coveredConceptsTotal when <= 100", () => {
        run(
          "record-question",
          JSON.stringify({
            taskId: "task1",
            topic: "a-react",
            concept: "hooks",
            question: "Q?",
            userAnswer: "A",
            isCorrect: true,
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "comprehension-check" }),
        );
        expect(result.ok).toBe(true);
        expect(result).not.toHaveProperty("coveredConceptsTotal");
        expect(result.flow).toBe("comprehension-check");
      });

      it("returns topicSummary with question counts", () => {
        run(
          "record-question",
          JSON.stringify({
            taskId: "task1",
            topic: "a-react",
            concept: "hooks",
            question: "Q1?",
            userAnswer: "A1",
            isCorrect: true,
          }),
        );
        run(
          "record-question",
          JSON.stringify({
            taskId: "task1",
            topic: "a-react",
            concept: "state",
            question: "Q2?",
            userAnswer: "A2",
            isCorrect: true,
          }),
        );
        run(
          "record-question",
          JSON.stringify({
            taskId: "task1",
            topic: "a-css",
            concept: "grid",
            question: "Q3?",
            userAnswer: "A3",
            isCorrect: true,
          }),
        );
        // Add a-css topic to config for allTopics
        run("add-topic", JSON.stringify({ key: "a-css", label: "CSS" }));

        const result = run(
          "session-brief",
          JSON.stringify({ flow: "comprehension-check" }),
        );
        expect(result.ok).toBe(true);
        const summary = result.topicSummary as Record<string, number>;
        expect(summary["a-react"]).toBe(2);
        expect(summary["a-css"]).toBe(1);
        expect(result.flow).toBe("comprehension-check");
      });

      it("returns allTopics from config as string array", () => {
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "comprehension-check" }),
        );
        expect(result.ok).toBe(true);
        const topics = result.allTopics as string[];
        expect(topics).toHaveLength(1);
        expect(topics[0]).toBe("a-react");
      });

      it("returns learner profile without lastUpdated", () => {
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "comprehension-check" }),
        );
        expect(result.ok).toBe(true);
        const learner = result.learner as Record<string, unknown>;
        expect(learner).not.toHaveProperty("lastUpdated");
        expect(result.flow).toBe("comprehension-check");
      });
    });

    describe("implementation-review flow", () => {
      it("returns minimal output with learner, currentTask, resumeContext", () => {
        run("update-profile", JSON.stringify({ level: "advanced" }));
        run(
          "update-progress",
          JSON.stringify({
            current_task: "task5",
            resume_context: "Implementing auth",
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "implementation-review" }),
        );
        expect(result.ok).toBe(true);
        const learner = result.learner as Record<string, unknown>;
        expect(learner.level).toBe("advanced");
        expect(learner).not.toHaveProperty("lastUpdated");
        expect(result.currentTask).toBe("task5");
        expect(result.resumeContext).toBe("Implementing auth");
        expect(result.flow).toBe("implementation-review");
      });

      it("returns null for missing currentTask and resumeContext", () => {
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "implementation-review" }),
        );
        expect(result.ok).toBe(true);
        expect(result.currentTask).toBeNull();
        expect(result.resumeContext).toBeNull();
        expect(result.flow).toBe("implementation-review");
      });

      it("does not include gaps or history data", () => {
        run(
          "add-gap",
          JSON.stringify({
            questionId: "q_impl0001",
            topic: "a-react",
            concept: "hooks",
            last_missed: "2026-01-01T00:00:00Z",
            task: "task1",
            note: "some gap",
          }),
        );
        const result = run(
          "session-brief",
          JSON.stringify({ flow: "implementation-review" }),
        );
        expect(result.ok).toBe(true);
        expect(result).not.toHaveProperty("gaps");
        expect(result).not.toHaveProperty("relevantGaps");
        expect(result).not.toHaveProperty("coveredConcepts");
        expect(result).not.toHaveProperty("gapCount");
        expect(result.flow).toBe("implementation-review");
      });
    });
  });

  describe("list-unresolved", () => {
    it("returns all gaps sorted by last_missed ascending", () => {
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
            unresolved_gaps: [
              {
                questionId: "q_lu000002",
                topic: "a-react",
                concept: "state",
                last_missed: "2026-03-01T00:00:00Z",
                task: "task1",
                note: "state gap",
              },
              {
                questionId: "q_lu000001",
                topic: "a-css",
                concept: "grid",
                last_missed: "2026-01-01T00:00:00Z",
                task: "task1",
                note: "css gap",
              },
            ],
            learner_profile: {},
          },
          null,
          2,
        ) + "\n",
      );
      const result = run("list-unresolved");
      expect(result.ok).toBe(true);
      const gaps = result.gaps as Array<Record<string, unknown>>;
      expect(gaps).toHaveLength(2);
      expect(gaps[0].questionId).toBe("q_lu000001");
      expect(gaps[0].lastMissed).toBe("2026-01-01T00:00:00Z");
      expect(gaps[1].questionId).toBe("q_lu000002");
      expect(result.gapCount).toEqual({ total: 2, filtered: 2 });
    });

    it("filters by topic when provided", () => {
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
            unresolved_gaps: [
              {
                questionId: "q_lut00001",
                topic: "a-react",
                concept: "hooks",
                last_missed: "2026-01-01T00:00:00Z",
                task: "task1",
                note: "react gap",
              },
              {
                questionId: "q_lut00002",
                topic: "a-css",
                concept: "grid",
                last_missed: "2026-01-02T00:00:00Z",
                task: "task1",
                note: "css gap",
              },
            ],
            learner_profile: {},
          },
          null,
          2,
        ) + "\n",
      );
      const result = run(
        "list-unresolved",
        JSON.stringify({ topic: "a-react" }),
      );
      expect(result.ok).toBe(true);
      const gaps = result.gaps as Array<Record<string, unknown>>;
      expect(gaps).toHaveLength(1);
      expect(gaps[0].topic).toBe("a-react");
      expect(result.gapCount).toEqual({ total: 2, filtered: 1 });
    });

    it("returns empty when no gaps exist", () => {
      const result = run("list-unresolved");
      expect(result.ok).toBe(true);
      const gaps = result.gaps as Array<Record<string, unknown>>;
      expect(gaps).toHaveLength(0);
      expect(result.gapCount).toEqual({ total: 0, filtered: 0 });
    });
  });

  describe("get-history-by-ids", () => {
    it("returns matching entries and lists notFound ids", () => {
      run(
        "record-question",
        JSON.stringify({
          taskId: "task1",
          topic: "a-react",
          concept: "hooks",
          question: "Q1?",
          userAnswer: "A1",
          isCorrect: true,
        }),
      );
      run(
        "record-question",
        JSON.stringify({
          taskId: "task1",
          topic: "a-react",
          concept: "state",
          question: "Q2?",
          userAnswer: "A2",
          isCorrect: false,
        }),
      );
      const history = readFixture("question-history.json") as {
        history: { id: string }[];
      };
      const firstId = history.history[0].id;
      const result = run(
        "get-history-by-ids",
        JSON.stringify({ ids: [firstId, "q_nonexistent"] }),
      );
      expect(result.ok).toBe(true);
      const entries = result.entries as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(firstId);
      const notFound = result.notFound as string[];
      expect(notFound).toHaveLength(1);
      expect(notFound[0]).toBe("q_nonexistent");
    });

    it("returns empty entries when no ids match", () => {
      run(
        "record-question",
        JSON.stringify({
          taskId: "task1",
          topic: "a-react",
          concept: "hooks",
          question: "Q?",
          userAnswer: "A",
          isCorrect: true,
        }),
      );
      const result = run(
        "get-history-by-ids",
        JSON.stringify({ ids: ["q_no_match_1", "q_no_match_2"] }),
      );
      expect(result.ok).toBe(true);
      const entries = result.entries as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(0);
      const notFound = result.notFound as string[];
      expect(notFound).toHaveLength(2);
    });

    it("fails when ids field is missing", () => {
      const result = run(
        "get-history-by-ids",
        JSON.stringify({ other: "field" }),
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("missing_field");
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
