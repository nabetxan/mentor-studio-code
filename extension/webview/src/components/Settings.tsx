import type {
  FileField,
  Locale,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { postMessage } from "../vscodeApi";

interface SettingsProps {
  config: MentorStudioConfig | null;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

interface FileSettingProps {
  label: string;
  field: FileField;
  value: string | null;
  createPrompt: string;
  locale: Locale;
}

function FileSetting({
  label,
  field,
  value,
  createPrompt,
  locale,
}: FileSettingProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopyPrompt = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setCopied(true);
    postMessage({ type: "copy", text: createPrompt });
    timerRef.current = setTimeout(() => setCopied(false), 2000);
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
              {t("settings.change", locale)}
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
        <span className="setting-warning">{t("settings.unset", locale)}</span>
        <p className="setting-guide">{t("settings.unsetGuide", locale)}</p>
        <div className="setting-actions">
          <button
            className="setting-btn"
            onClick={() => postMessage({ type: "selectFile", field })}
          >
            {t("settings.selectFile", locale)}
          </button>
          <button
            className="setting-btn"
            onClick={handleCopyPrompt}
            title="Copy prompt to create this file"
          >
            {copied ? "✓" : "📋"} {t("settings.createPrompt", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings({ config, locale, onLocaleChange }: SettingsProps) {
  const mentorFiles = config?.mentorFiles ?? {
    appDesign: null,
    roadmap: null,
  };

  return (
    <div className="settings">
      <div className="setting-item">
        <div className="setting-label">{t("settings.language", locale)}</div>
        <label className="locale-toggle">
          <span className={locale === "ja" ? "locale-active" : ""}>日本語</span>
          <input
            type="checkbox"
            className="locale-checkbox"
            checked={locale === "en"}
            onChange={() => onLocaleChange(locale === "ja" ? "en" : "ja")}
          />
          <span className={locale === "en" ? "locale-active" : ""}>
            English
          </span>
        </label>
      </div>

      <h3>{t("settings.mentorFiles", locale)}</h3>
      <FileSetting
        label={t("settings.appDesign", locale)}
        field="appDesign"
        value={mentorFiles.appDesign}
        createPrompt={t("settings.prompt.appDesign", locale)}
        locale={locale}
      />
      <FileSetting
        label={t("settings.roadmap", locale)}
        field="roadmap"
        value={mentorFiles.roadmap}
        createPrompt={t("settings.prompt.roadmap", locale)}
        locale={locale}
      />
    </div>
  );
}
