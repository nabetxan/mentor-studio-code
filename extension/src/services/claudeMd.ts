import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

const MENTOR_REF = "@.mentor/rules/MENTOR_RULES.md";

export interface MentorRefStatus {
  personal: boolean;
  project: boolean;
  personalPath: string;
  projectPath: string;
}

function getPersonalClaudeMdPath(wsRoot: vscode.Uri): string {
  return path.join(
    os.homedir(),
    ".claude",
    "projects",
    wsRoot.fsPath.replace(/[\\/]/g, "-"),
    "CLAUDE.md",
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

export async function findMentorRef(
  wsRoot: vscode.Uri,
): Promise<MentorRefStatus> {
  const personalPath = getPersonalClaudeMdPath(wsRoot);
  const projectPath = vscode.Uri.joinPath(wsRoot, "CLAUDE.md").fsPath;

  const personalContent = await readFileText(vscode.Uri.file(personalPath));
  const projectContent = await readFileText(
    vscode.Uri.joinPath(wsRoot, "CLAUDE.md"),
  );

  return {
    personal: personalContent.includes(MENTOR_REF),
    project: projectContent.includes(MENTOR_REF),
    personalPath,
    projectPath,
  };
}

export function removeMentorRefFromContent(content: string): string {
  const lines = content.split("\n");

  // Filter out lines whose trimmed content equals MENTOR_REF
  const filtered = lines.filter((line) => line.trim() !== MENTOR_REF);

  // Rejoin and collapse 3+ consecutive empty lines to 2
  const joined = filtered.join("\n");
  const collapsed = joined.replace(/\n{3,}/g, "\n\n");

  // Remove trailing blank lines, then restore single trailing newline
  const trimmed = collapsed.replace(/\n+$/, "");
  return trimmed === "" ? "" : trimmed + "\n";
}

export async function removeMentorRef(wsRoot: vscode.Uri): Promise<void> {
  const status = await findMentorRef(wsRoot);

  if (status.project) {
    const uri = vscode.Uri.joinPath(wsRoot, "CLAUDE.md");
    const content = await readFileText(uri);
    const updated = removeMentorRefFromContent(content);
    if (updated !== content) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(updated));
    }
  }

  if (status.personal) {
    const uri = vscode.Uri.file(status.personalPath);
    const content = await readFileText(uri);
    const updated = removeMentorRefFromContent(content);
    if (updated !== content) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(updated));
    }
  }
}

export async function addMentorRef(
  wsRoot: vscode.Uri,
  target: "project" | "personal",
): Promise<void> {
  let uri: vscode.Uri;

  if (target === "project") {
    uri = vscode.Uri.joinPath(wsRoot, "CLAUDE.md");
  } else {
    const personalPath = getPersonalClaudeMdPath(wsRoot);
    uri = vscode.Uri.file(personalPath);

    // Ensure directory exists
    const dirUri = vscode.Uri.file(path.dirname(personalPath));
    try {
      await vscode.workspace.fs.createDirectory(dirUri);
    } catch {
      // already exists
    }
  }

  const content = await readFileText(uri);

  // Skip if ref already present
  if (content.includes(MENTOR_REF)) {
    return;
  }

  if (content === "") {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(MENTOR_REF + "\n"));
  } else {
    const newContent = content.trimEnd() + "\n\n" + MENTOR_REF + "\n";
    await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent));
  }
}

export async function promptAndAddMentorRef(
  wsRoot: vscode.Uri,
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
      ? `メンター設定の参照をどこに追加しますか？\nプロジェクト: チーム全員に適用\n個人設定: 自分だけに適用`
      : `Where should the mentor config reference be added?\nProject: applies to the whole team\nPersonal: applies only to you`,
    { modal: true },
    projectLabel,
    personalLabel,
    skipLabel,
  );

  if (target === projectLabel) {
    await addMentorRef(wsRoot, "project");
    return "project";
  } else if (target === personalLabel) {
    await addMentorRef(wsRoot, "personal");
    return "personal";
  }

  return undefined;
}
