![version](https://img.shields.io/badge/version-0.0.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)

[日本語](README.md)

# Mentor Studio Code

A learning dashboard for AI mentor sessions using Claude Code. It provides an Overview, Actions, and Settings panel in the VS Code sidebar to help you track and continue your learning.

## Screenshot

The dashboard displays your mentor session progress.

<!-- To add a screenshot:
     1. Create the docs/images/ folder if it doesn't exist
     2. Save your image file to docs/images/
     3. Edit the line below to use the actual filename -->

![Dashboard](docs/images/screenshot.png)

## Prerequisites

**Required to install the extension:**

- [VS Code](https://code.visualstudio.com/) 1.85.0 or later
- [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) installed

> **Note:** To use the AI mentor features, you must have a Claude API key configured in Claude Code.

## Installation

### From the VS Code Marketplace (recommended)

1. Open VS Code
2. Open the Extensions tab (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Search for `Mentor Studio Code` and install

### From a VSIX file

1. Download the `.vsix` file from [Releases](https://github.com/nabetxan/mentor-studio-code/releases)
2. In the Extensions tab, click `…` in the top-right → `Install from VSIX…`

## Setup

1. Open the project you want to study in VS Code
2. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Mentor Studio: Setup Mentor`
4. A `.mentor-studio.json` file is generated in the project root
5. When the "Reload Window" dialog appears, click it
6. After reload, the Mentor Studio icon appears in the Activity Bar (left sidebar)

> **Tip:** If you open the dashboard before running Setup, you will see a prompt to run it.

## Usage

Click the Mentor Studio icon in the Activity Bar to open the dashboard. The dashboard is a single sidebar with three tabs.

The **Mentor** ON/OFF toggle in the navigation bar lets you enable or disable the mentor feature. The setting is read at the start of each session, so changes take effect from the next session.

### Overview

Shows your current task, correct answer rate, per-topic progress, and unresolved knowledge gaps.

### Actions

Copy prompts to send to your AI mentor with one click.

| Button                | Purpose                                 |
| --------------------- | --------------------------------------- |
| Start Next Task       | Use when starting the next task         |
| Review Implementation | Use when asking for a code review       |
| Start Review          | Use when starting a review session      |
| Start Check           | Use when starting a comprehension check |

### Settings

| Setting           | Description                                   |
| ----------------- | --------------------------------------------- |
| Plan / Spec files | Link the files your mentor session references |
| Language          | Switch between Japanese and English           |

## License

[MIT](LICENSE)
