import { describe, expect, it } from "vitest";

import {
  buildSetupCompletionMessage,
  resolveSetupEntrypointPlan,
} from "../src/commands/setup";

describe("resolveSetupEntrypointPlan", () => {
  it("keeps Mentor disabled for a fresh setup when no entrypoint ends up configured", () => {
    const result = resolveSetupEntrypointPlan({
      currentStatus: {
        projectClaudeMd: false,
        personalClaudeMd: false,
        projectAgentsMd: false,
        claudeMdScope: null,
        hasEntrypointFile: false,
      },
      selection: undefined,
      selectedClaudeScope: undefined,
    });

    expect(result.mentorEnabled).toBe(false);
  });

  it("keeps existing Mentor wiring enabled when setup is cancelled on an already-configured workspace", () => {
    const result = resolveSetupEntrypointPlan({
      currentStatus: {
        projectClaudeMd: false,
        personalClaudeMd: false,
        projectAgentsMd: true,
        claudeMdScope: null,
        hasEntrypointFile: true,
      },
      selection: undefined,
      selectedClaudeScope: undefined,
    });

    expect(result.mentorEnabled).toBe(true);
    expect(result.agentsMode).toBe("keep");
  });

  it("enables Mentor when setup explicitly keeps AGENTS.md only", () => {
    const result = resolveSetupEntrypointPlan({
      currentStatus: {
        projectClaudeMd: true,
        personalClaudeMd: false,
        projectAgentsMd: false,
        claudeMdScope: "project",
        hasEntrypointFile: true,
      },
      selection: {
        claudeMd: false,
        agentsMd: true,
      },
      selectedClaudeScope: undefined,
    });

    expect(result.claudeMode).toBe("remove");
    expect(result.agentsMode).toBe("ensure");
    expect(result.mentorEnabled).toBe(true);
  });

  it("does not enable Mentor when CLAUDE.md was selected but no scope was chosen and no other entrypoint remains", () => {
    const result = resolveSetupEntrypointPlan({
      currentStatus: {
        projectClaudeMd: false,
        personalClaudeMd: false,
        projectAgentsMd: false,
        claudeMdScope: null,
        hasEntrypointFile: false,
      },
      selection: {
        claudeMd: true,
        agentsMd: false,
      },
      selectedClaudeScope: undefined,
    });

    expect(result.claudeMode).toBe("keep");
    expect(result.agentsMode).toBe("remove");
    expect(result.mentorEnabled).toBe(false);
  });
});

describe("buildSetupCompletionMessage", () => {
  it("explains that Mentor remains disabled until an entrypoint is configured", () => {
    expect(buildSetupCompletionMessage(true, false)).toContain(
      "CLAUDE.md または AGENTS.md",
    );
    expect(buildSetupCompletionMessage(false, false)).toContain(
      "CLAUDE.md or AGENTS.md",
    );
  });
});
