import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { updateProfile } from "../../src/cli/commands/updateProfile";
import { makeEnv, writeProgress, type TestEnv } from "./helpers";

function readProgress(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("update-profile", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = makeEnv();
  });

  it("merges partial updates into learner_profile and sets last_updated", async () => {
    writeProgress(env.paths.progressPath, {
      current_task: 1,
      current_step: "s",
      resume_context: "c",
      learner_profile: {
        experience: "5y",
        level: "mid",
        interests: ["web"],
        weak_areas: ["css"],
        mentor_style: "socratic",
        last_updated: "2020-01-01T00:00:00.000Z",
      },
    });

    const before = Date.now();
    const res = await updateProfile(
      { level: "senior", interests: ["web", "security"] },
      env.paths,
    );
    const after = Date.now();
    expect(res).toEqual({ ok: true });

    const progress = readProgress(env.paths.progressPath);
    const profile = progress.learner_profile as Record<string, unknown>;
    expect(profile.experience).toBe("5y");
    expect(profile.level).toBe("senior");
    expect(profile.interests).toEqual(["web", "security"]);
    expect(profile.weak_areas).toEqual(["css"]);
    expect(profile.mentor_style).toBe("socratic");
    expect(typeof profile.last_updated).toBe("string");
    expect(profile.last_updated as string).toMatch(ISO_RE);
    const ts = Date.parse(profile.last_updated as string);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);

    // Top-level keys preserved.
    expect(progress.current_task).toBe(1);
    expect(progress.current_step).toBe("s");
    expect(progress.resume_context).toBe("c");
  });

  it("creates progress.json when missing", async () => {
    expect(existsSync(env.paths.progressPath)).toBe(false);

    const res = await updateProfile(
      {
        experience: "3y",
        level: "junior",
        interests: ["ts"],
        weak_areas: [],
        mentor_style: "direct",
      },
      env.paths,
    );
    expect(res).toEqual({ ok: true });

    const progress = readProgress(env.paths.progressPath);
    expect(progress.current_task).toBeNull();
    expect(progress.current_step).toBeNull();
    expect(progress.resume_context).toBeNull();
    const profile = progress.learner_profile as Record<string, unknown>;
    expect(profile.experience).toBe("3y");
    expect(profile.level).toBe("junior");
    expect(profile.interests).toEqual(["ts"]);
    expect(profile.weak_areas).toEqual([]);
    expect(profile.mentor_style).toBe("direct");
    expect(profile.last_updated as string).toMatch(ISO_RE);
  });

  it("sets last_updated even when no fields are provided", async () => {
    writeProgress(env.paths.progressPath, {
      current_task: null,
      current_step: null,
      resume_context: null,
      learner_profile: {
        experience: "old",
        last_updated: "2020-01-01T00:00:00.000Z",
      },
    });

    const res = await updateProfile({}, env.paths);
    expect(res).toEqual({ ok: true });

    const profile = readProgress(env.paths.progressPath)
      .learner_profile as Record<string, unknown>;
    expect(profile.experience).toBe("old");
    expect(profile.last_updated as string).not.toBe("2020-01-01T00:00:00.000Z");
    expect(profile.last_updated as string).toMatch(ISO_RE);
  });

  it("returns invalid_args when a string key is not a string", async () => {
    const res = await updateProfile({ experience: 5 }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
    expect(existsSync(env.paths.progressPath)).toBe(false);
  });

  it("returns invalid_args when an array key is not an array", async () => {
    const res = await updateProfile({ interests: "web" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns invalid_args when array contains non-string elements", async () => {
    const res = await updateProfile({ weak_areas: ["css", 42] }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("ignores unknown keys", async () => {
    writeProgress(env.paths.progressPath, {
      current_task: null,
      current_step: null,
      resume_context: null,
      learner_profile: {},
    });

    const res = await updateProfile({ level: "mid", bogus: "x" }, env.paths);
    expect(res).toEqual({ ok: true });

    const profile = readProgress(env.paths.progressPath)
      .learner_profile as Record<string, unknown>;
    expect(profile.level).toBe("mid");
    expect(profile.bogus).toBeUndefined();
  });

  it("returns progress_write_failed when progress.json cannot be written", async () => {
    const badPaths = {
      ...env.paths,
      progressPath: join(env.paths.mentorRoot, "no-such-dir", "progress.json"),
    };
    const res = await updateProfile({ level: "mid" }, badPaths);
    expect(res).toMatchObject({
      ok: false,
      error: "progress_write_failed",
      recoverable: true,
    });
  });
});
