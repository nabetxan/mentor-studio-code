import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export const MENTOR_REF = "@.mentor/rules/MENTOR_RULES.md";
export const AGENTS_ENTRYPOINT_START = "<!-- msc:agents:start -->";
export const AGENTS_ENTRYPOINT_END = "<!-- msc:agents:end -->";

const AGENTS_ENTRYPOINT_BLOCK = [
  AGENTS_ENTRYPOINT_START,
  MENTOR_REF,
  AGENTS_ENTRYPOINT_END,
].join("\n");

export interface MentorRefStatus {
  personal: boolean;
  project: boolean;
  personalPath: string;
  projectPath: string;
}

export interface MentorEntrypointStatus {
  projectClaudeMd: boolean;
  personalClaudeMd: boolean;
  projectAgentsMd: boolean;
  projectClaudeMdPath: string;
  personalClaudeMdPath: string;
  projectAgentsMdPath: string;
  claudeMdScope: "project" | "personal" | null;
  hasEntrypointFile: boolean;
}

export interface EntrypointFileSelection {
  claudeMd: boolean;
  agentsMd: boolean;
}

interface SetupEntrypointPromptStatus {
  claudeMdEnabled: boolean;
  agentsMdEnabled: boolean;
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

function getProjectAgentsMdUri(wsRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(wsRoot, "AGENTS.md");
}

function collapseWhitespace(content: string): string {
  const collapsed = content.replace(/\n{3,}/g, "\n\n");
  const trimmed = collapsed.replace(/\n+$/, "");
  return trimmed === "" ? "" : trimmed + "\n";
}

function stripAgentsEntrypointBlock(content: string): string {
  return content.replace(
    /\n?<!-- msc:agents:start -->[\s\S]*?<!-- msc:agents:end -->\n?/g,
    "\n",
  );
}

function hasManagedAgentsEntrypoint(content: string): boolean {
  return (
    content.includes(AGENTS_ENTRYPOINT_START) &&
    content.includes(AGENTS_ENTRYPOINT_END)
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
  const agentsProjectUri = getProjectAgentsMdUri(wsRoot);

  const [claudePersonalContent, claudeProjectContent, agentsProjectContent] =
    await Promise.all([
      readFileText(vscode.Uri.file(claudePersonalPath)),
      readFileText(claudeProjectUri),
      readFileText(agentsProjectUri),
    ]);

  const personalClaudeMd = claudePersonalContent.includes(MENTOR_REF);
  const projectClaudeMd = claudeProjectContent.includes(MENTOR_REF);
  const projectAgentsMd = hasManagedAgentsEntrypoint(agentsProjectContent);

  return {
    projectClaudeMd,
    personalClaudeMd,
    projectAgentsMd,
    projectClaudeMdPath: claudeProjectUri.fsPath,
    personalClaudeMdPath: claudePersonalPath,
    projectAgentsMdPath: agentsProjectUri.fsPath,
    claudeMdScope: projectClaudeMd
      ? "project"
      : personalClaudeMd
        ? "personal"
        : null,
    hasEntrypointFile:
      projectClaudeMd || personalClaudeMd || projectAgentsMd,
  };
}

export async function findMentorRef(
  wsRoot: vscode.Uri,
): Promise<MentorRefStatus> {
  const status = await getEntrypointStatus(wsRoot);
  return {
    personal: status.personalClaudeMd,
    project: status.projectClaudeMd,
    personalPath: status.personalClaudeMdPath,
    projectPath: status.projectClaudeMdPath,
  };
}

export function removeMentorRefFromContent(content: string): string {
  const lines = content.split("\n");
  const filtered = lines.filter((line) => line.trim() !== MENTOR_REF);
  return collapseWhitespace(filtered.join("\n"));
}

export function removeAgentsEntrypointBlockFromContent(content: string): string {
  return collapseWhitespace(stripAgentsEntrypointBlock(content));
}

async function removeClaudeEntrypointAtUri(uri: vscode.Uri): Promise<void> {
  const content = await readFileText(uri);
  const updated = removeMentorRefFromContent(content);
  if (updated !== content) {
    await writeFileText(uri, updated);
  }
}

async function removeAgentsEntrypointAtUri(uri: vscode.Uri): Promise<void> {
  const content = await readFileText(uri);
  const updated = removeAgentsEntrypointBlockFromContent(content);
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

async function ensureAgentsEntrypointBlock(uri: vscode.Uri): Promise<void> {
  const content = await readFileText(uri);
  if (content.includes(AGENTS_ENTRYPOINT_START)) {
    return;
  }
  const nextContent =
    content === ""
      ? `${AGENTS_ENTRYPOINT_BLOCK}\n`
      : `${content.trimEnd()}\n\n${AGENTS_ENTRYPOINT_BLOCK}\n`;
  await writeFileText(uri, nextContent);
}

export async function ensureProjectClaudeMdEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await ensureMentorRefLine(getProjectClaudeMdUri(wsRoot));
}

export async function ensurePersonalClaudeMdEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  const uri = vscode.Uri.file(getPersonalClaudeMdPath(wsRoot));
  await ensureParentDir(uri);
  await ensureMentorRefLine(uri);
}

export async function ensureProjectAgentsMdEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await ensureAgentsEntrypointBlock(getProjectAgentsMdUri(wsRoot));
}

export async function removeProjectClaudeMdEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await removeClaudeEntrypointAtUri(getProjectClaudeMdUri(wsRoot));
}

export async function removePersonalClaudeMdEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await removeClaudeEntrypointAtUri(
    vscode.Uri.file(getPersonalClaudeMdPath(wsRoot)),
  );
}

export async function removeProjectAgentsMdEntrypoint(
  wsRoot: vscode.Uri,
): Promise<void> {
  await removeAgentsEntrypointAtUri(getProjectAgentsMdUri(wsRoot));
}

export async function removeMentorRef(wsRoot: vscode.Uri): Promise<void> {
  await Promise.all([
    removeProjectClaudeMdEntrypoint(wsRoot),
    removePersonalClaudeMdEntrypoint(wsRoot),
    removeProjectAgentsMdEntrypoint(wsRoot),
  ]);
}

export async function addMentorRef(
  wsRoot: vscode.Uri,
  target: "project" | "personal",
): Promise<void> {
  if (target === "project") {
    await ensureProjectClaudeMdEntrypoint(wsRoot);
    return;
  }
  await ensurePersonalClaudeMdEntrypoint(wsRoot);
}

export async function setClaudeMdScope(
  wsRoot: vscode.Uri,
  target: "project" | "personal",
): Promise<void> {
  if (target === "project") {
    await ensureProjectClaudeMdEntrypoint(wsRoot);
    await removePersonalClaudeMdEntrypoint(wsRoot);
    return;
  }
  await ensurePersonalClaudeMdEntrypoint(wsRoot);
  await removeProjectClaudeMdEntrypoint(wsRoot);
}

export async function promptForClaudeMdScope(
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
      ? `Mentor の参照をどの CLAUDE.md に追加しますか？\nプロジェクト: チーム全員に適用\n個人設定: 自分だけに適用`
      : `Which CLAUDE.md should receive the Mentor reference?\nProject: applies to the whole team\nPersonal: applies only to you`,
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

export async function promptForSetupEntrypointFiles(
  isJa: boolean,
  currentStatus?: SetupEntrypointPromptStatus,
): Promise<EntrypointFileSelection | undefined> {
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
      {
        label: "CLAUDE.md",
        picked: currentStatus?.claudeMdEnabled ?? false,
      },
      {
        label: "AGENTS.md",
        picked: currentStatus?.agentsMdEnabled ?? false,
      },
    ],
    {
      canPickMany: true,
      ignoreFocusOut: true,
      placeHolder: isJa
        ? "Mentor機能を利用するエントリポイントファイルを選択してください"
        : "Choose the entrypoint files that should use Mentor",
      title: isJa
        ? "エントリポイントファイルを選択"
        : "Choose entrypoint files",
    },
  );

  if (!picks) {
    return undefined;
  }

  if (picks.length === 0) {
    await vscode.window.showInformationMessage(
      isJa
        ? "少なくとも CLAUDE.md または AGENTS.md のどちらかを選択してください。"
        : "Choose at least one of CLAUDE.md or AGENTS.md to continue.",
    );
    return undefined;
  }

  return {
    claudeMd: picks.some((pick) => pick.label === "CLAUDE.md"),
    agentsMd: picks.some((pick) => pick.label === "AGENTS.md"),
  };
}

export async function promptAndAddMentorRef(
  wsRoot: vscode.Uri,
  isJa: boolean,
): Promise<"project" | "personal" | undefined> {
  const target = await promptForClaudeMdScope(isJa);
  if (!target) {
    return undefined;
  }
  await setClaudeMdScope(wsRoot, target);
  return target;
}
