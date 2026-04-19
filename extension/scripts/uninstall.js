// vscode:uninstall script — runs as plain Node.js after extension is removed.
// CLAUDE.md is NOT touched (no user confirmation possible).
// Best-effort: sets enableMentor=false + extensionUninstalled=true in config.json.

const fs = require("fs");
const path = require("path");
const os = require("os");

function findWorkspacePaths() {
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
  const workspacePaths = [];
  const seen = new Set();

  let dirs;
  try {
    dirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true });
  } catch {
    return workspacePaths;
  }

  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;

    // Derive workspace path candidate from directory name.
    // Encoding replaces [:\\/] with '-', so we reverse that here.
    // On Windows, restore drive letter pattern: e.g., C-Users-... → C:\Users\...
    // On Unix, leading '-' becomes the root '/'.
    // Note: this is lossy for paths containing hyphens; workspacePath field
    // in config.json is the authoritative source when available.
    let candidate = dirent.name.replace(/-/g, path.sep);
    if (process.platform === "win32") {
      // Restore drive prefix: C\Users\... → C:\Users\...
      candidate = candidate.replace(/^([A-Za-z])\\/, "$1:\\");
    }

    // Scan every claude-projects entry for a matching .mentor/config.json —
    // earlier versions filtered on the MENTOR_REF appearing in personal
    // CLAUDE.md, which missed workspaces that added the ref only to project
    // CLAUDE.md. config.json existence is the authoritative signal.
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
      if (!seen.has(configPath)) {
        seen.add(configPath);
        workspacePaths.push(configPath);
      }
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
