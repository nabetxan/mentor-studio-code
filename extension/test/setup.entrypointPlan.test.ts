import { describe, expect, it } from "vitest";

import {
  buildSetupCompletionNotice,
  buildSetupCompletionMessage,
  buildSetupFinalConfig,
  resolveSetupInvocation,
  resolveSetupEntrypointPlan,
  shouldPromptForSetupEntrypoints,
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

  it("keeps existing CLAUDE.md wiring untouched when scope selection is cancelled", () => {
    const result = resolveSetupEntrypointPlan({
      currentStatus: {
        projectClaudeMd: true,
        personalClaudeMd: true,
        projectAgentsMd: false,
        claudeMdScope: "project",
        hasEntrypointFile: true,
      },
      selection: {
        claudeMd: true,
        agentsMd: false,
      },
      selectedClaudeScope: undefined,
    });

    expect(result.claudeMode).toBe("keep");
    expect(result.agentsMode).toBe("remove");
    expect(result.mentorEnabled).toBe(true);
  });
});

describe("buildSetupCompletionMessage", () => {
  it("tells users setup is ready after Mentor is enabled", () => {
    expect(buildSetupCompletionMessage(true, true)).toContain(
      "セットアップが完了しました",
    );
    expect(buildSetupCompletionMessage(false, true)).toContain(
      "setup complete",
    );
  });

  it("explains that Mentor remains disabled until an entrypoint is configured", () => {
    expect(buildSetupCompletionMessage(true, false)).toContain(
      "CLAUDE.md または AGENTS.md",
    );
    expect(buildSetupCompletionMessage(false, false)).toContain(
      "CLAUDE.md or AGENTS.md",
    );
  });
});

describe("buildSetupCompletionNotice", () => {
  it("uses the enabled completion message without a reload button", () => {
    const notice = buildSetupCompletionNotice({
      isJa: false,
      mentorEnabled: true,
    });

    expect(notice.message).toContain("setup complete");
    expect(notice.message).not.toContain("still disabled");
  });
});

describe("resolveSetupInvocation", () => {
  it("keeps manual and sidebar setup on the default interactive setup path", () => {
    expect(resolveSetupInvocation("commandPalette").options).toEqual({
      entrypointPrompt: "whenMissing",
    });
    expect(resolveSetupInvocation("sidebarNoConfig").options).toEqual({
      entrypointPrompt: "whenMissing",
    });
    expect(resolveSetupInvocation("settingsManual").options).toEqual({
      entrypointPrompt: "whenMissing",
    });
  });

  it("models notification setup intents explicitly", () => {
    expect(resolveSetupInvocation("migrationNotification")).toMatchObject({
      reason: "migration",
      options: {
        entrypointPrompt: "whenMissing",
      },
    });
    expect(resolveSetupInvocation("versionNotification")).toMatchObject({
      reason: "promptUpdate",
      options: {
        entrypointPrompt: "whenMissing",
      },
    });
  });
});

describe("shouldPromptForSetupEntrypoints", () => {
  it("skips entrypoint prompt when an entrypoint already exists", () => {
    expect(
      shouldPromptForSetupEntrypoints({
        mode: "whenMissing",
        hasExistingEntrypoint: true,
      }),
    ).toBe(false);
  });

  it("can still force the entrypoint prompt when explicitly requested", () => {
    expect(
      shouldPromptForSetupEntrypoints({
        mode: "always",
        hasExistingEntrypoint: true,
      }),
    ).toBe(true);
  });

  it("prompts when no entrypoint exists yet", () => {
    expect(
      shouldPromptForSetupEntrypoints({
        mode: "whenMissing",
        hasExistingEntrypoint: false,
      }),
    ).toBe(true);
  });
});

describe("buildSetupFinalConfig", () => {
  it("uses the latest on-disk config after DB bootstrap for the final write", () => {
    const staleConfig: Record<string, unknown> = {
      repositoryName: "discursin",
      enableMentor: false,
      extensionVersion: "0.6.9",
      workspacePath: "/Users/jonatan/workspace/discursin",
    };

    const latestConfig: Record<string, unknown> = {
      repositoryName: "discursin",
      enableMentor: false,
      extensionVersion: "0.6.9",
      workspacePath: "/Users/jonatan/workspace/discursin",
      workspaceId: "discursin-d03a46d7-ee71-49b2-83e4-26397fde4cbb",
      preservedByDbBootstrap: true,
    };

    const finalConfig = buildSetupFinalConfig({
      staleConfig,
      latestConfig,
      mentorEnabled: true,
    });

    expect(finalConfig.workspaceId).toBe(
      "discursin-d03a46d7-ee71-49b2-83e4-26397fde4cbb",
    );
    expect(finalConfig.enableMentor).toBe(true);
    expect(finalConfig.preservedByDbBootstrap).toBe(true);
  });
});
