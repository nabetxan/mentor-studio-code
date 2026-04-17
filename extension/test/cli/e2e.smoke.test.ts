import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { bootstrapDb } from "../../src/db";
import { seedPlans, seedTasks } from "./helpers";

const DIST = join(__dirname, "..", "..", "dist");
const CLI = join(DIST, "mentor-cli.js");

describe("mentor-cli end-to-end (bundled)", () => {
  let mentorRoot: string;
  let toolsDir: string;
  let topicId: number;
  let taskId: number;

  function run(cmd: string, argJson?: string): Record<string, unknown> {
    const args =
      argJson !== undefined
        ? [join(toolsDir, "mentor-cli.js"), cmd, argJson]
        : [join(toolsDir, "mentor-cli.js"), cmd];
    const out = execFileSync("node", args, { encoding: "utf-8" });
    return JSON.parse(out.trim()) as Record<string, unknown>;
  }

  beforeAll(async () => {
    mentorRoot = mkdtempSync(join(tmpdir(), "msc-e2e-"));
    toolsDir = join(mentorRoot, "tools");
    mkdirSync(toolsDir, { recursive: true });
    cpSync(CLI, join(toolsDir, "mentor-cli.js"));
    cpSync(join(DIST, "sql-wasm.wasm"), join(toolsDir, "sql-wasm.wasm"));
    const dbPath = join(mentorRoot, "data.db");
    await bootstrapDb(dbPath, {
      wasmPath: join(toolsDir, "sql-wasm.wasm"),
      topics: [{ label: "JS" }],
    });
    topicId = 1;
    await seedPlans(dbPath, [
      {
        name: "P1",
        status: "active",
        sortOrder: 0,
        createdAt: "2026-04-12T00:00:00Z",
      },
    ]);
    await seedTasks(dbPath, [
      { planId: 1, name: "T1", status: "active", sortOrder: 0 },
      { planId: 1, name: "T2", status: "queued", sortOrder: 1 },
    ]);
    taskId = 1;
  });

  it("list-topics", () => {
    const r = run("list-topics");
    expect(r).toMatchObject({ ok: true, topics: [{ id: 1, label: "JS" }] });
  });

  it("add-topic", () => {
    const r = run("add-topic", JSON.stringify({ label: "CSS" }));
    expect(r).toMatchObject({ ok: true, label: "CSS" });
  });

  it("session-brief mentor-session", () => {
    const r = run("session-brief", JSON.stringify({ flow: "mentor-session" }));
    expect(r.ok).toBe(true);
  });

  it("session-brief review", () => {
    const r = run("session-brief", JSON.stringify({ flow: "review" }));
    expect(r.ok).toBe(true);
  });

  it("session-brief comprehension-check", () => {
    const r = run(
      "session-brief",
      JSON.stringify({ flow: "comprehension-check" }),
    );
    expect(r.ok).toBe(true);
  });

  it("session-brief implementation-review", () => {
    const r = run(
      "session-brief",
      JSON.stringify({ flow: "implementation-review" }),
    );
    expect(r.ok).toBe(true);
  });

  it("list-unresolved", () => {
    const r = run("list-unresolved", JSON.stringify({}));
    expect(r).toMatchObject({ ok: true });
  });

  it("record-answer insert", () => {
    const r = run(
      "record-answer",
      JSON.stringify({
        taskId: null,
        topicId,
        concept: "closure",
        question: "what is a closure?",
        userAnswer: "a function with captured scope",
        isCorrect: true,
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("update-profile", () => {
    const r = run(
      "update-profile",
      JSON.stringify({ experience: "junior", interests: ["web"] }),
    );
    expect(r.ok).toBe(true);
  });

  it("update-progress", () => {
    const r = run(
      "update-progress",
      JSON.stringify({ current_step: "writing tests" }),
    );
    expect(r.ok).toBe(true);
  });

  it("update-task", () => {
    const r = run(
      "update-task",
      JSON.stringify({ id: taskId, status: "completed" }),
    );
    expect(r.ok).toBe(true);
  });

  it("unknown command returns JSON error", () => {
    let stdout = "";
    try {
      execFileSync(
        "node",
        [join(toolsDir, "mentor-cli.js"), "no-such-command"],
        { encoding: "utf-8" },
      );
    } catch (e) {
      stdout = (e as { stdout: string }).stdout;
    }
    const r = JSON.parse(stdout.trim()) as Record<string, unknown>;
    expect(r).toMatchObject({ ok: false, error: "unknown_command" });
  });
});
