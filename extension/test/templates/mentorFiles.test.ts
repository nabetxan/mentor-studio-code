import { describe, expect, it } from "vitest";

import { MENTOR_SKILLS } from "../../src/templates/mentorFiles";

describe("SKILL.md templates", () => {
  it("no legacy gap/question-history references", () => {
    for (const [name, content] of Object.entries(MENTOR_SKILLS)) {
      expect(content, name).not.toMatch(/add-gap|remove-gap|update-gap/);
      expect(content, name).not.toMatch(/question-history\.json/);
      expect(content, name).not.toMatch(/unresolved_gaps/);
      expect(content, name).not.toMatch(/record-question\b/);
      expect(content, name).not.toMatch(/reviewOf/);
      expect(content, name).not.toMatch(/\ba-[a-z]/);
      expect(content, name).not.toMatch(/mentorFiles\.plan/);
      expect(content, name).not.toMatch(/tracker-format/);
      expect(content, name).not.toMatch(/add-completed-task/);
      expect(content, name).not.toMatch(/add-skipped-task/);
      expect(content, name).not.toMatch(/remove-skipped-task/);
    }
  });

  it("uses topicId integer in record-answer examples", () => {
    for (const [name, content] of Object.entries(MENTOR_SKILLS)) {
      if (/record-answer/.test(content)) {
        expect(content, name).toMatch(/"topicId"\s*:\s*\d+/);
      }
    }
  });

  it("mentor-session SKILL mentions update-task completed and nextTask", () => {
    const ms = MENTOR_SKILLS["mentor-session/SKILL.md"];
    expect(ms).toMatch(/update-task/);
    expect(ms).toMatch(/nextTask/);
    expect(ms).toMatch(/planCompleted/);
    expect(ms).toMatch(/Plan Panel/);
  });

  it("comprehension-check passes taskId:null in record-answer", () => {
    const cc = MENTOR_SKILLS["comprehension-check/SKILL.md"];
    expect(cc).toMatch(/"taskId"\s*:\s*null/);
  });

  it("all four flow SKILL.md templates are present", () => {
    expect(Object.keys(MENTOR_SKILLS).sort()).toEqual([
      "comprehension-check/SKILL.md",
      "implementation-review/SKILL.md",
      "mentor-session/SKILL.md",
      "review/SKILL.md",
    ]);
  });
});
