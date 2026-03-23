import type { MentorStudioConfig } from "@mentor-studio/shared";
import { useState } from "react";
import { postMessage } from "../vscodeApi";

interface SettingsProps {
  config: MentorStudioConfig | null;
}

interface FileSettingProps {
  label: string;
  field: "appDesign" | "roadmap";
  value: string | null;
  createPrompt: string;
}

function FileSetting({ label, field, value, createPrompt }: FileSettingProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = () => {
    setCopied(true);
    postMessage({ type: "copy", text: createPrompt });
    setTimeout(() => setCopied(false), 2000);
  };

  if (value) {
    return (
      <div className="setting-item">
        <div className="setting-label">{label}</div>
        <div className="setting-value">
          <span className="setting-path" title={value}>
            {value}
          </span>
          <div className="setting-actions">
            <button
              className="setting-btn"
              onClick={() => postMessage({ type: "selectFile", field })}
              title="Change file"
            >
              Change
            </button>
            <button
              className="setting-btn setting-btn-clear"
              onClick={() => postMessage({ type: "clearFile", field })}
              title="Clear setting"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setting-item">
      <div className="setting-label">{label}</div>
      <div className="setting-unset">
        <span className="setting-warning">⚠ 未設定</span>
        <div className="setting-actions">
          <button
            className="setting-btn"
            onClick={() => postMessage({ type: "selectFile", field })}
          >
            Select File
          </button>
          <button
            className="setting-btn"
            onClick={handleCopyPrompt}
            title="Copy prompt to create this file"
          >
            {copied ? "✓" : "📋"} Create prompt
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings({ config }: SettingsProps) {
  const mentorFiles = config?.mentorFiles ?? {
    appDesign: null,
    roadmap: null,
  };

  return (
    <div className="settings">
      <h3>Mentor Files</h3>
      <FileSetting
        label="App Design"
        field="appDesign"
        value={mentorFiles.appDesign}
        createPrompt="docs/mentor/rules/MENTOR_RULES.md を読んで、このプロジェクトの app-design.md を作成してください。不足している情報があればユーザーに質問してください。"
      />
      <FileSetting
        label="Roadmap / Plan"
        field="roadmap"
        value={mentorFiles.roadmap}
        createPrompt="docs/mentor/rules/MENTOR_RULES.md を読んで、このプロジェクトの learning-roadmap.md を作成してください。不足している情報があればユーザーに質問してください。"
      />
    </div>
  );
}
