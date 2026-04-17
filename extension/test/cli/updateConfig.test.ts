import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { beforeEach, describe, expect, it } from "vitest";

import { updateConfig } from "../../src/cli/commands/updateConfig";
import { makeEnv, type TestEnv } from "./helpers";

function writeConfig(path: string, config: Record<string, unknown>): void {
  writeFileSync(path, JSON.stringify(config), "utf-8");
}

function readConfig(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

describe("update-config", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = makeEnv();
  });

  it("merges mentorFiles partial update without clobbering siblings", async () => {
    writeConfig(env.paths.configPath, {
      repositoryName: "demo",
      locale: "ja",
      mentorFiles: { plan: "old.md", spec: "old-spec.md" },
    });

    const res = await updateConfig(
      { mentorFiles: { spec: "new-spec.md" } },
      env.paths,
    );
    expect(res).toEqual({ ok: true });

    const config = readConfig(env.paths.configPath);
    expect(config.repositoryName).toBe("demo");
    expect(config.mentorFiles).toEqual({ plan: "old.md", spec: "new-spec.md" });
  });

  it("accepts null to clear a mentorFiles field", async () => {
    writeConfig(env.paths.configPath, {
      mentorFiles: { plan: "p.md", spec: "s.md" },
    });
    const res = await updateConfig({ mentorFiles: { spec: null } }, env.paths);
    expect(res).toEqual({ ok: true });
    expect(readConfig(env.paths.configPath).mentorFiles).toEqual({
      plan: "p.md",
      spec: null,
    });
  });

  it("returns config_missing when config.json does not exist", async () => {
    expect(existsSync(env.paths.configPath)).toBe(false);
    const res = await updateConfig(
      { mentorFiles: { plan: "x.md" } },
      env.paths,
    );
    expect(res).toMatchObject({ ok: false, error: "config_missing" });
  });

  it("returns invalid_json when config.json is malformed", async () => {
    writeFileSync(env.paths.configPath, "{ broken", "utf-8");
    const res = await updateConfig(
      { mentorFiles: { plan: "x.md" } },
      env.paths,
    );
    expect(res).toMatchObject({ ok: false, error: "invalid_json" });
  });

  it("returns invalid_args when mentorFiles is not an object", async () => {
    writeConfig(env.paths.configPath, { mentorFiles: {} });
    const res = await updateConfig({ mentorFiles: "oops" }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns invalid_args when mentorFiles.plan is not string|null", async () => {
    writeConfig(env.paths.configPath, { mentorFiles: {} });
    const res = await updateConfig({ mentorFiles: { plan: 42 } }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("writes config.json with trailing newline", async () => {
    writeConfig(env.paths.configPath, { mentorFiles: {} });
    await updateConfig({ mentorFiles: { spec: "p.md" } }, env.paths);
    const raw = readFileSync(env.paths.configPath, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("returns invalid_args when mentorFiles.plan is a string (plan is DB-managed)", async () => {
    writeConfig(env.paths.configPath, { mentorFiles: {} });
    const res = await updateConfig(
      { mentorFiles: { plan: "new.md" } },
      env.paths,
    );
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });

  it("returns invalid_args when mentorFiles.plan is null (plan is DB-managed)", async () => {
    writeConfig(env.paths.configPath, { mentorFiles: { plan: "old.md" } });
    const res = await updateConfig({ mentorFiles: { plan: null } }, env.paths);
    expect(res).toMatchObject({ ok: false, error: "invalid_args" });
  });
});
