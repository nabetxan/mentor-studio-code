import type {
  FileField,
  Locale,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { postMessage } from "../vscodeApi";
import { CheckIcon, CopyIcon, SparkleIcon } from "./icons";

interface SettingsProps {
  config: MentorStudioConfig | null;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  profileLastUpdated: string | null;
}

interface FileSettingProps {
  label: string;
  field: FileField;
  value: string | null;
  createPrompt: string;
  locale: Locale;
  warning?: boolean;
}

function FileSetting({
  label,
  field,
  value,
  createPrompt,
  locale,
  warning,
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
      <div className={`setting-item${warning ? " setting-item--warning" : ""}`}>
        <div className="setting-label">{label}</div>
        <div className="setting-value">
          <div
            style={{
              fontSize: "0.75rem",
              wordBreak: "break-all",
              opacity: 0.8,
              marginBottom: "5px",
            }}
          >
            {value}
          </div>
          <div className="setting-actions">
            <button
              className="btn-primary"
              onClick={() => postMessage({ type: "selectFile", field })}
            >
              {t("settings.change", locale)}
            </button>
            <button
              className="btn-outlined"
              onClick={() => postMessage({ type: "clearFile", field })}
            >
              外す
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`setting-item${warning ? " setting-item--warning" : ""}`}>
      <div className="setting-label">{label}</div>
      <div className="setting-unset">
        <span className="setting-warning">{t("settings.unset", locale)}</span>
        <div className="setting-actions">
          <button
            className="btn-primary"
            onClick={() => postMessage({ type: "selectFile", field })}
          >
            {t("settings.selectFile", locale)}
          </button>
          <button
            className="btn-secondary"
            onClick={handleCopyPrompt}
            title="Copy prompt to create this file"
          >
            {copied ? <CheckIcon /> : <SparkleIcon />}{" "}
            {t("settings.createPrompt", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProfileSectionProps {
  profileLastUpdated: string | null;
  locale: Locale;
}

function ProfileSection({ profileLastUpdated, locale }: ProfileSectionProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setCopied(true);
    postMessage({ type: "copy", text: t("settings.prompt.intake", locale) });
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`setting-item${!profileLastUpdated ? " setting-item--warning" : ""}`}
    >
      <p className="actions-description">{t("actions.description", locale)}</p>
      <button className="snippet-btn" onClick={handleCopy}>
        <span className="snippet-title">
          {profileLastUpdated
            ? t("settings.profile.update", locale)
            : t("settings.profile.register", locale)}
        </span>
        <span className="snippet-icon">
          {copied ? (
            <>
              <CheckIcon />
              <span className="snippet-copied-text">
                {t("actions.copied", locale)}
              </span>
            </>
          ) : (
            <CopyIcon />
          )}
        </span>
      </button>
    </div>
  );
}

export function Settings({
  config,
  locale,
  onLocaleChange,
  profileLastUpdated,
}: SettingsProps) {
  const mentorFiles = config?.mentorFiles ?? {
    spec: null,
    plan: null,
  };

  return (
    <div className="settings">
      <ProfileSection profileLastUpdated={profileLastUpdated} locale={locale} />
      <p className="setting-guide">{t("settings.unsetGuide", locale)}</p>
      <FileSetting
        label={t("settings.plan", locale)}
        field="plan"
        value={mentorFiles.plan}
        createPrompt={t("settings.prompt.plan", locale)}
        locale={locale}
        warning={!mentorFiles.plan}
      />
      <FileSetting
        label={t("settings.spec", locale)}
        field="spec"
        value={mentorFiles.spec}
        createPrompt={t("settings.prompt.spec", locale)}
        locale={locale}
      />
      <div className="setting-item">
        <div className="setting-label">{t("settings.language", locale)}</div>
        <label className="locale-toggle">
          <span className={locale === "en" ? "locale-active" : ""}>
            English
          </span>
          <input
            type="checkbox"
            className="locale-checkbox"
            checked={locale === "ja"}
            onChange={() => onLocaleChange(locale === "ja" ? "en" : "ja")}
          />
          <span className={locale === "ja" ? "locale-active" : ""}>日本語</span>
        </label>
      </div>
    </div>
  );
}
