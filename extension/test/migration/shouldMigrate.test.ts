import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldMigrate } from "../../src/migration/shouldMigrate";

function mkMentor(): string {
  const root = mkdtempSync(join(tmpdir(), "msc-mig-"));
  mkdirSync(join(root, ".mentor"));
  return join(root, ".mentor");
}

describe("shouldMigrate", () => {
  it("false when question-history.json does not exist", () => {
    const mentor = mkMentor();
    expect(shouldMigrate(mentor)).toBe(false);
  });

  it("false when question-history.json is empty array", () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "question-history.json"), "[]");
    expect(shouldMigrate(mentor)).toBe(false);
  });

  it("false when data.db already exists", () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "question-history.json"), '[{"id":"q1"}]');
    writeFileSync(join(mentor, "data.db"), "");
    expect(shouldMigrate(mentor)).toBe(false);
  });

  it("false when question-history.json is invalid JSON", () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "question-history.json"), "not-json");
    expect(shouldMigrate(mentor)).toBe(false);
  });

  it("true when history non-empty and db absent", () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "question-history.json"), '[{"id":"q1"}]');
    expect(shouldMigrate(mentor)).toBe(true);
  });

  it("true when history is wrapped in {history: [...]} (real data shape)", () => {
    const mentor = mkMentor();
    writeFileSync(
      join(mentor, "question-history.json"),
      '{"history":[{"id":"q1"}]}',
    );
    expect(shouldMigrate(mentor)).toBe(true);
  });

  it("false when {history: []} is empty", () => {
    const mentor = mkMentor();
    writeFileSync(join(mentor, "question-history.json"), '{"history":[]}');
    expect(shouldMigrate(mentor)).toBe(false);
  });
});
