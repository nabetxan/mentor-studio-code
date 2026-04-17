import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { updateProgress } from "../../src/cli/commands/updateProgress";
import { makeEnv, writeProgress, type TestEnv } from "./helpers";

function readProgress(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

describe("update-progress", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = makeEnv();
  });

  it("updates resume_context, preserving other fields", async () => {
    writeProgress(env.paths.progressPath, {
      current_task: 7,
      resume_context: "old-ctx",
      learner_profile: { experience: "5y" },
    });

    const res = await updateProgress({ resume_context: "ctx-B" }, env.paths);
    expect(res).toEqual({ ok: true });

    const progress = readProgress(env.paths.progressPath);
    expect(progress.resume_context).toBe("ctx-B");
    expect(progress.current_task).toBe(7);
    expect(progress.learner_profile).toEqual({ experience: "5y" });
  });

  it("ignores current_task argument silently", async () => {
    writeProgress(env.paths.progressPath, {
      current_task: 3,
      resume_context: null,
      learner_profile: {},
    });

    const res = await updateProgress({ current_task: 99 }, env.paths);
    expect(res).toEqual({ ok: true });

    // No known keys → no write, original file unchanged
    const progress = readProgress(env.paths.progressPath);
    expect(progress.current_task).toBe(3);
  });

  it("current_step is no longer a known key — returns ok:true with no file write", async () => {
    expect(existsSync(env.paths.progressPath)).toBe(false);

    const res = await updateProgress({ current_step: "foo" }, env.paths);
    expect(res).toEqual({ ok: true });

    // No write because current_step is not a known key
    expect(existsSync(env.paths.progressPath)).toBe(false);
  });

  it("creates progress.json when missing with empty learner_profile", async () => {
    expect(existsSync(env.paths.progressPath)).toBe(false);

    const res = await updateProgress({ resume_context: "c1" }, env.paths);
    expect(res).toEqual({ ok: true });

    const progress = readProgress(env.paths.progressPath);
    expect(progress).toEqual({
      resume_context: "c1",
      learner_profile: {},
    });
  });

  it("accepts null values for resume_context", async () => {
    writeProgress(env.paths.progressPath, {
      resume_context: "y",
      learner_profile: {},
    });

    const res = await updateProgress({ resume_context: null }, env.paths);
    expect(res).toEqual({ ok: true });

    const progress = readProgress(env.paths.progressPath);
    expect(progress.resume_context).toBeNull();
  });

  it("accepts string values", async () => {
    writeProgress(env.paths.progressPath, {
      resume_context: null,
      learner_profile: {},
    });

    const res = await updateProgress({ resume_context: "world" }, env.paths);
    expect(res).toEqual({ ok: true });

    const progress = readProgress(env.paths.progressPath);
    expect(progress.resume_context).toBe("world");
  });

  it("returns invalid_args when resume_context is a number", async () => {
    const res = await updateProgress({ resume_context: 42 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns invalid_args when resume_context is an array", async () => {
    const res = await updateProgress({ resume_context: ["a", "b"] }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("does not write progress.json when validation fails", async () => {
    expect(existsSync(env.paths.progressPath)).toBe(false);
    const res = await updateProgress({ resume_context: 123 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    expect(existsSync(env.paths.progressPath)).toBe(false);
  });

  it("returns invalid_json when progress.json is malformed", async () => {
    writeFileSync(env.paths.progressPath, "{ not valid json", "utf-8");
    const res = await updateProgress({ resume_context: "s" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_json" });
  });

  it("writes progress.json with trailing newline", async () => {
    writeProgress(env.paths.progressPath, {
      resume_context: null,
      learner_profile: {},
    });
    await updateProgress({ resume_context: "s" }, env.paths);
    const raw = readFileSync(env.paths.progressPath, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("returns progress_write_failed when progress.json cannot be written", async () => {
    const badPaths = {
      ...env.paths,
      progressPath: join(env.paths.mentorRoot, "no-such-dir", "progress.json"),
    };
    const res = await updateProgress({ resume_context: "s" }, badPaths);
    expect(res).toMatchObject({
      ok: false,
      error: "progress_write_failed",
      recoverable: true,
    });
  });

  it("is a no-op when no known keys are provided", async () => {
    writeProgress(env.paths.progressPath, {
      resume_context: "keep",
      learner_profile: { a: 1 },
    });

    const res = await updateProgress({}, env.paths);
    expect(res).toEqual({ ok: true });

    const progress = readProgress(env.paths.progressPath);
    expect(progress.resume_context).toBe("keep");
  });

  it("does not create progress.json when no known keys are provided", async () => {
    expect(existsSync(env.paths.progressPath)).toBe(false);
    const res = await updateProgress({ unknown: "x" }, env.paths);
    expect(res).toEqual({ ok: true });
    expect(existsSync(env.paths.progressPath)).toBe(false);
  });
});
