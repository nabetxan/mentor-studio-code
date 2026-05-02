import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export const MENTOR_REF = "@.mentor/rules/MENTOR_RULES.md";
export const CODEX_ENTRYPOINT_START = "<!-- msc:codex:start -->";
export const CODEX_ENTRYPOINT_END = "<!-- msc:codex:end -->";

const CODEX_ENTRYPOINT_BLOCK = [
  CODEX_ENTRYPOINT_START,
  "Read `.mentor/config.json`.",
  "- If config is missing or invalid, stop.",
  "- If `enableMentor` is false, stop.",
  `- If \`enableMentor\` is true, continue to \`${MENTOR_REF}\`.`,
  CODEX_ENTRYPOINT_END,
].join("\n");

export interface MentorRefStatus {
  personal: boolean;
  project: boolean;
  personalPath: string;
  projectPath: string;
}

export interface MentorEntrypointStatus {
  claudeProject: boolean;
  claudePersonal: boolean;
  codexProject: boolean;
  claudeProjectPath: string;
  claudePersonalPath: string;
  codexProjectPath: string;
  claudeMode: "project" | "personal" | null;
  anyEntrypoint: boolean;
}

export interface ProviderSetupSelection {
  claude: boolean;
  codex: boolean;
}

function getPersonalClaudeMdPath(wsRoot: vscode.Uri): string {
  return path.join(
    os.homedir(),
    ".claude",
    "projects",
    wsRoot.fsPath.replace(/[:\\/]/g, "-"),
    "CLAUDE.md",
  );
}

function getProjectClaudeMdUri(wsRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(wsRoot, "CLAUDE.md");
}

function getProjectCodexAgentsUri(wsRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(wsRoot, "AGENTS.md");
}

function collapseWhitespace(content: string): string {
  const collapsed = content.replace(/\n{3,}/g, "\n\n");
  const trimmed = collapsed.replace(/\n+$/, "");
  return trimmed === "" ? "" : trimmed + "\n";
}

function stripCodexEntrypointBlock(content: string): string {
  return content.replace(
    /\n?<!-- msc:codex:start -->[\s\S]*?<!-- msc:codex:end -->\n?/g,
    "\n",
  );
}

function hasManagedCodexEntrypoint(content: string): boolean {
  return (
    content.includes(CODEX_ENTRYPOINT_START) &&
    content.includes(CODEX_ENTRYPOINT_END)
  );
}

async function readFileText(uri: vscode.Uri): Promise<string> {
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(raw).toString();
  } catch {
    return "";
  }
}

async function writeFileText(uri: vscode.Uri, content: string): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
}

async function ensureParentDir(uri: vscode.Uri): Promise<void> {
  const createDirectory = (
    vscode.workspace.fs as typeof vscode.workspace.fs & {
      createDirectory?: (uri: vscode.Uri) => Promise<void>;
    }
  ).createDirectory;
  if (!createDirectory) {
    return;
  }
  await createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
}

export async function getEntrypointStatus(
  wsRoot: vscode.Uri,
): Promise<MentorEntrypointStatus> {
  const claudePersonalPath = getPersonalClaudeMdPath(wsRoot);
  const claudeProjectUri = getProjectClaudeMdUri(wsRoot);
  const codexProjectUri = getProjectCodexAgentsUri(wsRoot);

  const [claudePersonalContent, claudeProjectContent, codexProjectContent] =
    await Promise.all([
      readFileText(vscode.Uri.file(claudePersonalPath)),
      readFileText(claudeProjectUri),
      readFileText(codexProjectUri),
    ]);

  const claudePersonal = claudePersonalContent.includes(MENTOR_REF);
  const claudeProject = claudeProjectContent.includes(MENTOR_REF);
  const codexProject = hasManagedCodexEntrypoint(codexProjectContent);

  return {
    claudeProject,
    claudePersonal,
    codexProject,
    claudeProjectPath: claudeProjectUri.fsPath,
    claudePersonalPath,
    codexProjectPath: codexProjectUri.fsPath,
    claudeMode: claudeProject
      ? "project"
      : claudePersonal
        ? "personal"
        : null,
    anyEntrypoint: claudeProject || claudePersonal || codexProject,
  };
}

export async function findMentorRef(
  wsRoot: vscode.Uri,
): Promise<MentorRefStatus> {
  const status = await getEntrypointStatus(wsRoot);
  return {
    personal: status.claudePersonal,
    project: status.claudeProject,
    personalPath: status.claudePersonalPath,
    projectPath: status.claudeProjectPath,
  };
}

export function removeMentorRefFromContent(content: string): string {
  const lines = content.split("\n");
  const filtered = lines.filter((line) => line.trim() !== MENTOR_REF);
  return collapseWhitespace(filtered.join("\n"));
}

export function removeCodexEntrypointBlockFromContent(content: string): string {
  return collapseWhitespace(stripCodexEntrypointBlock(content));
}

async function removeClaudeEntrypointAtUri(uri: vscode.Uri): Promise<void> {
  const content = await readFileText(uri);
  const updated = removeMentorRefFromContent(content);
  if (updated !== content) {
    await writeFileText(uri, updated);
  }
}

async function removeCodexEntrypointAtUri(uri: vscode.Uri): Promise<void> {
  const content = await readFileText(uri);
  const updated = removeCodexEntrypointBlockFromContent(content);
  if (updated !== content) {
    await writeFileText(uri, updated);
  }
}

async function ensureMentorRefLine(uri: vscode.Uri): Promise<void> {
  const content = await readFileText(uri);
  if (content.includes(MENTOR_REF)) {
    return;
  }
  const nextContent =
    content === "" ? `${MENTOR_REF}\n` : `${content.trimEnd()}\n\n${MENTOR_REF}\n`;
  await writeFileText(uri, nextContent);
}

async function ensureCodexEntrypointBlock(uri: vscode.Uri): Promise<void> {
  const content = await readFileText(uri);
  if (content.includes(CODEX_ENTRYPOINT_START)) {
    return;
  }
  const nextContent =
    content === ""
      ? `${CODEX_ENTRYPOINT_BLOCK}\n`
      : `${content.trimEnd()}\n\n${CODEX_ENTRYPOINT_BLOCK}\n`;
  await writeFileText(uri, nextContent);
}

export async function ensureClaudeProjectEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await ensureMentorRefLine(getProjectClaudeMdUri(wsRoot));
}

export async function ensureClaudePersonalEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  const uri = vscode.Uri.file(getPersonalClaudeMdPath(wsRoot));
  await ensureParentDir(uri);
  await ensureMentorRefLine(uri);
}

export async function ensureCodexProjectEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await ensureCodexEntrypointBlock(getProjectCodexAgentsUri(wsRoot));
}

export async function removeClaudeProjectEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await removeClaudeEntrypointAtUri(getProjectClaudeMdUri(wsRoot));
}

export async function removeClaudePersonalEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await removeClaudeEntrypointAtUri(
    vscode.Uri.file(getPersonalClaudeMdPath(wsRoot)),
  );
}

export async function removeCodexProjectEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await removeCodexEntrypointAtUri(getProjectCodexAgentsUri(wsRoot));
}

export async function removeMentorRef(wsRoot: vscode.Uri): Promise<void> {
  await Promise.all([
    removeClaudeProjectEntrypoint(wsRoot),
    removeClaudePersonalEntrypoint(wsRoot),
    removeCodexProjectEntrypoint(wsRoot),
  ]);
}

export async function addMentorRef(
  wsRoot: vscode.Uri,
  target: "project" | "personal",
): Promise<void> {
  if (target === "project") {
    await ensureClaudeProjectEntrypoint(wsRoot);
    return;
  }
  await ensureClaudePersonalEntrypoint(wsRoot);
}

export async function setClaudeMode(
  wsRoot: vscode.Uri,
  target: "project" | "personal",
): Promise<void> {
  if (target === "project") {
    await ensureClaudeProjectEntrypoint(wsRoot);
    await removeClaudePersonalEntrypoint(wsRoot);
    return;
  }
  await ensureClaudePersonalEntrypoint(wsRoot);
  await removeClaudeProjectEntrypoint(wsRoot);
}

export async function promptForClaudeMode(
  isJa: boolean,
): Promise<"project" | "personal" | undefined> {
  const projectLabel = isJa
    ? "プロジェクト (CLAUDE.md)"
    : "Project (CLAUDE.md)";
  const personalLabel = isJa
    ? "個人設定 (~/.claude/projects/)"
    : "Personal (~/.claude/projects/)";
  const skipLabel = isJa ? "スキップ" : "Skip";

  const target = await vscode.window.showInformationMessage(
    isJa
      ? `Claude Code のメンター設定をどこに追加しますか？\nプロジェクト: チーム全員に適用\n個人設定: 自分だけに適用`
      : `Where should the Claude Code mentor reference be added?\nProject: applies to the whole team\nPersonal: applies only to you`,
    { modal: true },
    projectLabel,
    personalLabel,
    skipLabel,
  );

  if (target === projectLabel) {
    return "project";
  }
  if (target === personalLabel) {
    return "personal";
  }
  return undefined;
}

export async function promptForSetupProviders(
  isJa: boolean,
): Promise<ProviderSetupSelection | undefined> {
  if (!("showQuickPick" in vscode.window)) {
    return undefined;
  }

  const showQuickPick = (
    vscode.window as typeof vscode.window & {
      showQuickPick?: <T extends vscode.QuickPickItem>(
        items: readonly T[] | Thenable<readonly T[]>,
        options: vscode.QuickPickOptions & { canPickMany: true },
      ) => Thenable<readonly T[] | undefined>;
    }
  ).showQuickPick;

  if (!showQuickPick) {
    return undefined;
  }

  const picks = await showQuickPick(
    [
      { label: "Claude Code" },
      { label: "Codex" },
    ],
    {
      canPickMany: true,
      ignoreFocusOut: true,
      placeHolder: isJa
        ? "Mentor機能を利用するAIツールを選択してください"
        : "Choose the AI tools that should use Mentor",
      title: isJa ? "AI ツールを選択" : "Choose AI tools",
    },
  );

  if (!picks) {
    return undefined;
  }

  if (picks.length === 0) {
    await vscode.window.showInformationMessage(
      isJa
        ? "少なくとも Claude Code または Codex のどちらかを選択してください。"
        : "Choose at least one of Claude Code or Codex to continue.",
    );
    return undefined;
  }

  return {
    claude: picks.some((pick) => pick.label === "Claude Code"),
    codex: picks.some((pick) => pick.label === "Codex"),
  };
}

export async function promptAndAddMentorRef(
  wsRoot: vscode.Uri,
  isJa: boolean,
): Promise<"project" | "personal" | undefined> {
  const target = await promptForClaudeMode(isJa);
  if (!target) {
    return undefined;
  }
  await setClaudeMode(wsRoot, target);
  return target;
}
