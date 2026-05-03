import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as vscode from "vscode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENTS_ENTRYPOINT_END,
  AGENTS_ENTRYPOINT_START,
  ensureProjectAgentsMdEntrypoint,
  getEntrypointStatus,
  promptForSetupEntrypointFiles,
  removeAgentsEntrypointBlockFromContent,
  removeMentorRefFromContent,
  setClaudeMdScope,
} from "../src/services/claudeMd";

const REF = "@.mentor/rules/MENTOR_RULES.md";

describe("removeMentorRefFromContent", () => {
  it("removes the exact line containing the mentor ref", () => {
    const content = `## Git\n\nNEVER COMMIT.\n\n${REF}\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("## Git\n\nNEVER COMMIT.\n");
  });

  it("removes ref with leading/trailing whitespace on the line", () => {
    const content = `line1\n  ${REF}  \nline3\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("line1\nline3\n");
  });

  it("collapses triple blank lines to double after removal", () => {
    const content = `line1\n\n${REF}\n\nline3\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("line1\n\nline3\n");
  });

  it("returns content unchanged if ref not present", () => {
    const content = "## Git\n\nSome content\n";
    const result = removeMentorRefFromContent(content);
    expect(result).toBe(content);
  });

  it("handles file with only the ref line", () => {
    const content = `${REF}\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("");
  });

  it("handles multiple occurrences (removes all)", () => {
    const content = `${REF}\nsome text\n${REF}\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("some text\n");
  });

  it("removes the managed mentor block from AGENTS.md content", () => {
    const content = `# Agents\n\n${AGENTS_ENTRYPOINT_START}\n${REF}\n${AGENTS_ENTRYPOINT_END}\n\nKeep local rules.\n`;
    const result = removeAgentsEntrypointBlockFromContent(content);
    expect(result).toBe("# Agents\n\nKeep local rules.\n");
  });

  it("does not remove a user-authored AGENTS mentor reference line without managed block markers", () => {
    const content = `# Agents\n\n${REF}\nKeep local rules.\n`;
    const result = removeAgentsEntrypointBlockFromContent(content);
    expect(result).toBe(content);
  });
});

describe("provider-aware entrypoints", () => {
  let workdir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), "mentor-entrypoints-"));
    originalHome = process.env.HOME;
    process.env.HOME = join(workdir, "fake-home");

    vi.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri) =>
      Uint8Array.from(readFileSync(uri.fsPath)),
    );
    vi.spyOn(vscode.workspace.fs, "writeFile").mockImplementation(
      async (uri, content) => {
        writeFileSync(uri.fsPath, Buffer.from(content));
      },
    );
    vi.spyOn(vscode.workspace.fs, "createDirectory").mockImplementation(
      async (uri) => {
        await import("node:fs/promises").then((fs) =>
          fs.mkdir(uri.fsPath, { recursive: true }),
        );
      },
    );
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    vi.restoreAllMocks();
  });

  it("detects project AGENTS.md entrypoints", async () => {
    const wsRoot = vscode.Uri.file(workdir);
    writeFileSync(
      join(workdir, "AGENTS.md"),
      `# Agents\n\n${AGENTS_ENTRYPOINT_START}\n${REF}\n${AGENTS_ENTRYPOINT_END}\n`,
    );

    const status = await getEntrypointStatus(wsRoot);

    expect(status.projectAgentsMd).toBe(true);
    expect(status.hasEntrypointFile).toBe(true);
    expect(status.claudeMdScope).toBeNull();
  });

  it("does not treat a bare AGENTS mentor reference line as a managed AGENTS.md entrypoint", async () => {
    const wsRoot = vscode.Uri.file(workdir);
    writeFileSync(join(workdir, "AGENTS.md"), `# Agents\n\n${REF}\n`);

    const status = await getEntrypointStatus(wsRoot);

    expect(status.projectAgentsMd).toBe(false);
    expect(status.hasEntrypointFile).toBe(false);
  });

  it("writes a compact managed AGENTS.md entrypoint block", async () => {
    const wsRoot = vscode.Uri.file(workdir);

    await ensureProjectAgentsMdEntrypoint(wsRoot);

    const agents = readFileSync(join(workdir, "AGENTS.md"), "utf-8");
    expect(agents).toBe(
      `${AGENTS_ENTRYPOINT_START}\n${REF}\n${AGENTS_ENTRYPOINT_END}\n`,
    );
  });

  it("switches CLAUDE.md to personal scope and removes the project entrypoint", async () => {
    const wsRoot = vscode.Uri.file(workdir);
    writeFileSync(join(workdir, "CLAUDE.md"), `${REF}\n`);

    await setClaudeMdScope(wsRoot, "personal");

    const projectClaude = readFileSync(join(workdir, "CLAUDE.md"), "utf-8");
    const personalClaude = readFileSync(
      join(
        process.env.HOME ?? "",
        ".claude",
        "projects",
        workdir.replace(/[:\\/]/g, "-"),
        "CLAUDE.md",
      ),
      "utf-8",
    );

    expect(projectClaude).toBe("");
    expect(personalClaude).toContain(REF);

    const status = await getEntrypointStatus(wsRoot);
    expect(status.projectClaudeMd).toBe(false);
    expect(status.personalClaudeMd).toBe(true);
    expect(status.claudeMdScope).toBe("personal");
  });

  it("treats empty setup entrypoint file selection as blocked and explains why", async () => {
    vi.spyOn(
      vscode.window as unknown as {
        showQuickPick: (
          ...args: unknown[]
        ) => Promise<vscode.QuickPickItem[] | undefined>;
      },
      "showQuickPick",
    ).mockResolvedValue([]);
    const info = vi.spyOn(vscode.window, "showInformationMessage");

    const result = await promptForSetupEntrypointFiles(true);

    expect(result).toBeUndefined();
    expect(info).toHaveBeenCalledWith(
      "少なくとも CLAUDE.md または AGENTS.md のどちらかを選択してください。",
    );
  });

  it("preselects currently enabled entrypoint files in setup", async () => {
    const showQuickPick = vi
      .spyOn(
        vscode.window as unknown as {
          showQuickPick: (
            ...args: unknown[]
          ) => Promise<vscode.QuickPickItem[] | undefined>;
        },
        "showQuickPick",
      )
      .mockResolvedValue([{ label: "CLAUDE.md" }, { label: "AGENTS.md" }]);

    await promptForSetupEntrypointFiles(true, {
      claudeMdEnabled: true,
      agentsMdEnabled: true,
    });

    expect(showQuickPick).toHaveBeenCalledWith(
      [
        { label: "CLAUDE.md", picked: true },
        { label: "AGENTS.md", picked: true },
      ],
      expect.any(Object),
    );
  });
});
