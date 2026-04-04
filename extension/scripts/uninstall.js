// vscode:uninstall script — runs as plain Node.js after extension is removed.
// CLAUDE.md is NOT touched (no user confirmation possible).
// Best-effort: sets enableMentor=false + extensionUninstalled=true in config.json.

const fs = require("fs");
const path = require("path");
const os = require("os");

const MENTOR_REF = "@.mentor/rules/MENTOR_RULES.md";

function findWorkspacePaths() {
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
  const workspacePaths = [];

  let dirs;
  try {
    dirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true });
  } catch {
    return workspacePaths;
  }

  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;

    // Check if this project's CLAUDE.md contains the mentor ref
    const claudeMdPath = path.join(claudeProjectsDir, dirent.name, "CLAUDE.md");
    let claudeContent;
    try {
      claudeContent = fs.readFileSync(claudeMdPath, "utf-8");
    } catch {
      continue;
    }

    if (!claudeContent.includes(MENTOR_REF)) continue;

    // Derive workspace path candidate from directory name
    // e.g., -Users-kaori-workspace-my-app → /Users/kaori/workspace/my-app
    const candidate = dirent.name.replace(/-/g, "/");

    // Try to read config.json and get the authoritative workspacePath
    const candidateConfigPath = path.join(candidate, ".mentor", "config.json");
    let configPath = candidateConfigPath;

    try {
      const configRaw = fs.readFileSync(candidateConfigPath, "utf-8");
      const config = JSON.parse(configRaw);
      // If workspacePath field exists, use it as the authoritative path
      if (config.workspacePath && typeof config.workspacePath === "string") {
        const authConfigPath = path.join(
          config.workspacePath,
          ".mentor",
          "config.json",
        );
        if (fs.existsSync(authConfigPath)) {
          configPath = authConfigPath;
        }
      }
      workspacePaths.push(configPath);
    } catch {
      // candidate path doesn't work — silent failure, best effort
      continue;
    }
  }

  return workspacePaths;
}

function updateConfig(configPath) {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    config.enableMentor = false;
    config.extensionUninstalled = true;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  } catch {
    // Silent failure — best effort
  }
}

// Main
const configPaths = findWorkspacePaths();
for (const configPath of configPaths) {
  updateConfig(configPath);
}
