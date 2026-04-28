import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanupRuntimeArtifacts,
  wipeExternalDataDirAt,
} from "../src/commands/removeMentor";

function makeMentor(): string {
  const root = mkdtempSync(join(tmpdir(), "msc-cleanup-"));
  const mentor = join(root, ".mentor");
  mkdirSync(mentor, { recursive: true });
  return mentor;
}

describe("cleanupRuntimeArtifacts", () => {
  it("removes data.db, data.db.lock/ (recursive), data.db.bak, sql-wasm.wasm, tools/mentor-cli.cjs, tools/mentor-cli.js (legacy), tools/sql-wasm.wasm", async () => {
    const mentor = makeMentor();
    mkdirSync(join(mentor, "data.db.lock"), { recursive: true });
    mkdirSync(join(mentor, "tools"), { recursive: true });
    writeFileSync(join(mentor, "data.db"), "db");
    writeFileSync(join(mentor, "data.db.lock", "owner.json"), "{}");
    writeFileSync(join(mentor, "data.db.bak"), "bak");
    writeFileSync(join(mentor, "sql-wasm.wasm"), "wasm");
    writeFileSync(join(mentor, "tools", "mentor-cli.cjs"), "cli");
    writeFileSync(join(mentor, "tools", "mentor-cli.js"), "legacy-cli");
    writeFileSync(join(mentor, "tools", "sql-wasm.wasm"), "legacy-wasm");

    await cleanupRuntimeArtifacts(mentor);

    expect(existsSync(join(mentor, "data.db"))).toBe(false);
    expect(existsSync(join(mentor, "data.db.lock"))).toBe(false);
    expect(existsSync(join(mentor, "data.db.bak"))).toBe(false);
    expect(existsSync(join(mentor, "sql-wasm.wasm"))).toBe(false);
    expect(existsSync(join(mentor, "tools", "mentor-cli.cjs"))).toBe(false);
    expect(existsSync(join(mentor, "tools", "mentor-cli.js"))).toBe(false);
    expect(existsSync(join(mentor, "tools", "sql-wasm.wasm"))).toBe(false);
  });

  it("does not touch user-owned files (config.json, skills/, rules/, markdowns)", async () => {
    const mentor = makeMentor();
    const configPath = join(mentor, "config.json");
    const skillPath = join(mentor, "skills", "mentor-session", "SKILL.md");
    const rulePath = join(mentor, "rules", "MENTOR_RULES.md");
    const mdPath = join(mentor, "NOTES.md");
    mkdirSync(join(mentor, "skills", "mentor-session"), { recursive: true });
    mkdirSync(join(mentor, "rules"), { recursive: true });
    writeFileSync(configPath, '{"enableMentor":true}');
    writeFileSync(skillPath, "# skill");
    writeFileSync(rulePath, "# rules");
    writeFileSync(mdPath, "# notes");

    const before = {
      config: readFileSync(configPath, "utf-8"),
      skill: readFileSync(skillPath, "utf-8"),
      rule: readFileSync(rulePath, "utf-8"),
      md: readFileSync(mdPath, "utf-8"),
      configMtime: statSync(configPath).mtimeMs,
    };

    await cleanupRuntimeArtifacts(mentor);

    expect(readFileSync(configPath, "utf-8")).toBe(before.config);
    expect(readFileSync(skillPath, "utf-8")).toBe(before.skill);
    expect(readFileSync(rulePath, "utf-8")).toBe(before.rule);
    expect(readFileSync(mdPath, "utf-8")).toBe(before.md);
    expect(statSync(configPath).mtimeMs).toBe(before.configMtime);
  });

  it("is idempotent when artifacts are already missing", async () => {
    const mentor = makeMentor();
    await expect(cleanupRuntimeArtifacts(mentor)).resolves.toBeUndefined();
    await expect(cleanupRuntimeArtifacts(mentor)).resolves.toBeUndefined();
  });
});

describe("wipeExternalDataDirAt", () => {
  it("returns true and removes the directory when it exists", async () => {
    const root = mkdtempSync(join(tmpdir(), "msc-wipe-"));
    const dir = join(root, "ws-uuid");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "data.db"), "db");

    const result = await wipeExternalDataDirAt(dir, root);

    expect(result).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });

  it("returns false and is a no-op when the directory doesn't exist", async () => {
    const root = mkdtempSync(join(tmpdir(), "msc-wipe-"));
    const dir = join(root, "missing-ws-uuid");

    const result = await wipeExternalDataDirAt(dir, root);

    expect(result).toBe(false);
    expect(existsSync(dir)).toBe(false);
  });

  it("recursively deletes nested files and subdirectories", async () => {
    const root = mkdtempSync(join(tmpdir(), "msc-wipe-"));
    const dir = join(root, "ws-uuid");
    const sub = join(dir, "nested", "deeper");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(dir, "data.db"), "db");
    writeFileSync(join(dir, "nested", "owner.json"), "{}");
    writeFileSync(join(sub, "leaf.txt"), "leaf");

    const result = await wipeExternalDataDirAt(dir, root);

    expect(result).toBe(true);
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(join(dir, "data.db"))).toBe(false);
    expect(existsSync(sub)).toBe(false);
  });

  it("refuses to delete a directory outside the allowed root", async () => {
    const root = mkdtempSync(join(tmpdir(), "msc-wipe-root-"));
    const outside = mkdtempSync(join(tmpdir(), "msc-wipe-outside-"));

    await expect(wipeExternalDataDirAt(outside, root)).rejects.toThrow(
      "Refusing to delete outside managed data root",
    );
    expect(existsSync(outside)).toBe(true);
  });
});
