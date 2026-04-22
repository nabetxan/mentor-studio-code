import { describe, expect, it } from "vitest";

import {
  INTAKE_SKILL_MD,
  MENTOR_SESSION_SKILL_MD,
  MENTOR_SKILLS,
  PLAN_HEALTH_MD,
  SHARED_RULES_MD,
} from "../../src/templates/mentorFiles";

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

describe("plan-health.md template", () => {
  it("contains the three case markers", () => {
    expect(PLAN_HEALTH_MD).toMatch(/Case A/);
    expect(PLAN_HEALTH_MD).toMatch(/Case B/);
    expect(PLAN_HEALTH_MD).toMatch(/Case C/);
  });

  it("contains the Plan Status Reference table", () => {
    expect(PLAN_HEALTH_MD).toMatch(/Plan Status Reference/);
    expect(PLAN_HEALTH_MD).toMatch(/\|\s*`backlog`\s*\|/);
    expect(PLAN_HEALTH_MD).toMatch(/\|\s*`removed`\s*\|/);
  });

  it("has no legacy refs", () => {
    expect(PLAN_HEALTH_MD).not.toMatch(/question-history\.json/);
    expect(PLAN_HEALTH_MD).not.toMatch(/unresolved_gaps/);
    expect(PLAN_HEALTH_MD).not.toMatch(/tracker-format/);
    expect(PLAN_HEALTH_MD).not.toMatch(/mentorFiles\.plan/);
  });

  it("contains Spec handoff sub-flow", () => {
    expect(PLAN_HEALTH_MD).toMatch(/Spec handoff/);
    expect(PLAN_HEALTH_MD).toMatch(/deactivate-plan/);
    expect(PLAN_HEALTH_MD).toMatch(/remove-plan/);
    expect(PLAN_HEALTH_MD).toMatch(/update-config.*mentorFiles.*spec/s);
    expect(PLAN_HEALTH_MD).toMatch(/## Overview/);
    expect(PLAN_HEALTH_MD).toMatch(/## Non-Goals/);
  });
});

describe("mentor-session/SKILL.md after split", () => {
  it("no longer inlines Case A/B/C blocks", () => {
    expect(MENTOR_SESSION_SKILL_MD).not.toMatch(/\*\*Case A —/);
    expect(MENTOR_SESSION_SKILL_MD).not.toMatch(/\*\*Case B —/);
    expect(MENTOR_SESSION_SKILL_MD).not.toMatch(/\*\*Case C —/);
  });

  it("references plan-health.md for conditional load", () => {
    expect(MENTOR_SESSION_SKILL_MD).toMatch(
      /\.mentor\/skills\/mentor-session\/plan-health\.md/,
    );
  });

  it("still contains Teaching Cycle steps (a)-(i)", () => {
    expect(MENTOR_SESSION_SKILL_MD).toMatch(/### \(a\) Explain/);
    expect(MENTOR_SESSION_SKILL_MD).toMatch(/### \(i\) RECORD/);
  });
});

describe("shared-rules.md after dedup", () => {
  it("has a single CLI / data access section", () => {
    const cliToolHeadings = (SHARED_RULES_MD.match(/^## CLI Tool/gm) ?? [])
      .length;
    const dataAccessHeadings = (
      SHARED_RULES_MD.match(/^## Data Access Rule/gm) ?? []
    ).length;
    expect(cliToolHeadings + dataAccessHeadings).toBe(1);
  });

  it("still documents camelCase output note", () => {
    expect(SHARED_RULES_MD).toMatch(/camelCase/);
  });

  it("still lists read commands", () => {
    expect(SHARED_RULES_MD).toMatch(/session-brief/);
    expect(SHARED_RULES_MD).toMatch(/list-unresolved/);
    expect(SHARED_RULES_MD).toMatch(/list-topics/);
  });
});

describe("INTAKE_SKILL_MD", () => {
  it("contains both flow headings", () => {
    expect(INTAKE_SKILL_MD).toMatch(/^## Initial Intake Flow$/m);
    expect(INTAKE_SKILL_MD).toMatch(/^## Update Flow$/m);
  });

  it("has entry section branching on learner.lastUpdated", () => {
    expect(INTAKE_SKILL_MD).toMatch(/^## Entry$/m);
    expect(INTAKE_SKILL_MD).toMatch(/learner\.lastUpdated/);
    expect(INTAKE_SKILL_MD).toMatch(/\[flow:intake\]/);
    expect(INTAKE_SKILL_MD).toMatch(/session-brief/);
  });

  it("documents the start-over escape hatch", () => {
    expect(INTAKE_SKILL_MD).toMatch(/start over/i);
  });

  it("Update Flow references a diff confirmation step", () => {
    expect(INTAKE_SKILL_MD).toMatch(/Before/);
    expect(INTAKE_SKILL_MD).toMatch(/After/);
  });

  it("still contains all 5 initial intake questions", () => {
    for (const q of [
      "Question 1: Experience",
      "Question 2: Self-assessed Level",
      "Question 3: Interests",
      "Question 4: Weak Areas",
      "Question 5: Mentor Style",
    ]) {
      expect(INTAKE_SKILL_MD).toContain(q);
    }
  });
});
