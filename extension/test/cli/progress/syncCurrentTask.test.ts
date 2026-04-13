import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { syncCurrentTask } from "../../../src/cli/progress/syncCurrentTask";
import { makeEnv } from "../helpers";

describe("syncCurrentTask", () => {
  it("updates current_task while preserving other keys", async () => {
    const env = makeEnv();
    writeFileSync(
      env.paths.progressPath,
      JSON.stringify({
        current_task: 1,
        current_step: "step-a",
        resume_context: "ctx",
        learner_profile: { name: "K" },
        extra: "keep",
      }),
      "utf-8",
    );

    await syncCurrentTask(env.paths.progressPath, 7);

    const got = JSON.parse(
      readFileSync(env.paths.progressPath, "utf-8"),
    ) as Record<string, unknown>;
    expect(got).toEqual({
      current_task: 7,
      current_step: "step-a",
      resume_context: "ctx",
      learner_profile: { name: "K" },
      extra: "keep",
    });
  });

  it("sets current_task to null", async () => {
    const env = makeEnv();
    writeFileSync(
      env.paths.progressPath,
      JSON.stringify({ current_task: 3 }),
      "utf-8",
    );

    await syncCurrentTask(env.paths.progressPath, null);

    const got = JSON.parse(
      readFileSync(env.paths.progressPath, "utf-8"),
    ) as Record<string, unknown>;
    expect(got.current_task).toBeNull();
  });

  it("creates progress.json with §3 simplified shape when missing", async () => {
    const env = makeEnv();
    expect(existsSync(env.paths.progressPath)).toBe(false);

    await syncCurrentTask(env.paths.progressPath, 42);

    const raw = readFileSync(env.paths.progressPath, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual({
      current_task: 42,
      current_step: null,
      resume_context: null,
      learner_profile: {},
    });
  });

  it("throws when the target directory does not exist", async () => {
    const env = makeEnv();
    const badPath = join(env.dir, "no-such-dir", "progress.json");
    await expect(syncCurrentTask(badPath, 1)).rejects.toThrow();
  });
});
