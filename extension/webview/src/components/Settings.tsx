import type {
  CleanupOptions,
  FileField,
  Locale,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useState } from "react";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import type { TranslationKey } from "../i18n";
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
  buttonLabel: string;
  tooltipKey: TranslationKey;
  locale: Locale;
  warning?: boolean;
}

function FileSetting({
  label,
  field,
  value,
  createPrompt,
  buttonLabel,
  tooltipKey,
  locale,
  warning,
}: FileSettingProps) {
  const [copiedKey, triggerCopy] = useCopyFeedback();
  const copied = copiedKey !== null;

  const handleCopyPrompt = () => {
    postMessage({ type: "copy", text: createPrompt });
    triggerCopy("copied");
  };

  if (value) {
    return (
      <div className={`setting-item${warning ? " setting-item--warning" : ""}`}>
        {warning && (
          <span className="setting-warning-badge" aria-hidden="true">
            !
          </span>
        )}
        <div className="setting-label">{label}</div>
        <div className="setting-value">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              postMessage({ type: "openFile", relativePath: value });
            }}
            className="file-path-link"
            title={value}
          >
            {value}
          </a>
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
              {t("settings.detach", locale)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`setting-item${warning ? " setting-item--warning" : ""}`}>
      {warning && (
        <span className="setting-warning-badge" aria-hidden="true">
          !
        </span>
      )}
      <div className="setting-label-row">
        <div className="setting-label">{label}</div>
        <span className="setting-warning">{t("settings.unset", locale)}</span>
      </div>
      <div className="setting-unset">
        <div className="setting-actions-vertical">
          <button
            className="btn-primary"
            onClick={() => postMessage({ type: "selectFile", field })}
          >
            {t("settings.selectFile", locale)}
          </button>
          <button
            className="snippet-btn"
            onClick={handleCopyPrompt}
            data-tooltip={t(tooltipKey, locale)}
          >
            <span className="snippet-title">{buttonLabel}</span>
            <span className="snippet-icon" aria-live="polite">
              {copied ? (
                <>
                  <CheckIcon />
                  <span className="snippet-copied-text">
                    {t("actions.copied", locale)}
                  </span>
                </>
              ) : (
                <SparkleIcon />
              )}
            </span>
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
  const [copiedKey, triggerCopy] = useCopyFeedback();
  const copied = copiedKey !== null;

  const handleCopy = () => {
    postMessage({ type: "copy", text: t("settings.prompt.intake", locale) });
    triggerCopy("copied");
  };

  return (
    <div
      className={`setting-item${!profileLastUpdated ? " setting-item--warning" : ""}`}
    >
      {!profileLastUpdated && (
        <span className="setting-warning-badge" aria-hidden="true">
          !
        </span>
      )}
      <p className="actions-description">{t("actions.description", locale)}</p>
      <div className="setting-actions-vertical">
        <button
          className="snippet-btn"
          onClick={handleCopy}
          data-tooltip={t("settings.copyCreatePrompt.profile", locale)}
        >
          <span className="snippet-title">
            {profileLastUpdated
              ? t("settings.profile.update", locale)
              : t("settings.profile.register", locale)}
          </span>
          <span className="snippet-icon" aria-live="polite">
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
        {profileLastUpdated && (
          <span className="profile-last-updated">
            {t("settings.profile.lastUpdated", locale)}{" "}
            {new Date(profileLastUpdated).toLocaleDateString(locale)}
          </span>
        )}
      </div>
    </div>
  );
}

function UninstallSection({ locale }: { locale: Locale }) {
  const [expanded, setExpanded] = useState(false);
  const [checks, setChecks] = useState<CleanupOptions>({
    mentorFolder: false,
    profile: true,
    claudeMdRef: true,
  });

  const toggle = (key: keyof CleanupOptions) =>
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasSelection =
    checks.mentorFolder || checks.profile || checks.claudeMdRef;

  const handleCleanup = () => {
    postMessage({ type: "cleanupMentor", options: checks });
  };

  return (
    <div className="setting-item setting-item--remove">
      <div className="uninstall-title">
        {t("settings.uninstall.title", locale)}
      </div>
      <p className="setting-remove-description">
        {t("settings.uninstall.description", locale)}
      </p>
      <button
        className="btn-text-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded
          ? t("settings.uninstall.hideDetails", locale)
          : t("settings.uninstall.showDetails", locale)}
      </button>
      {expanded && (
        <div className="uninstall-details">
          <label className="uninstall-check">
            <input
              type="checkbox"
              checked={checks.mentorFolder}
              onChange={() => toggle("mentorFolder")}
            />
            {t("settings.uninstall.check.mentorFolder", locale)}
          </label>
          <label className="uninstall-check">
            <input
              type="checkbox"
              checked={checks.profile}
              onChange={() => toggle("profile")}
            />
            {t("settings.uninstall.check.profile", locale)}
          </label>
          <label className="uninstall-check">
            <input
              type="checkbox"
              checked={checks.claudeMdRef}
              onChange={() => toggle("claudeMdRef")}
            />
            {t("settings.uninstall.check.claudeMdRef", locale)}
          </label>
          <p className="uninstall-warning">
            {t("settings.uninstall.warning", locale)}
          </p>
          <button
            className="btn-remove"
            disabled={!hasSelection}
            onClick={handleCleanup}
          >
            {t("settings.uninstall.cleanup", locale)}
          </button>
        </div>
      )}
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
        buttonLabel={t("settings.createPrompt.plan", locale)}
        tooltipKey="settings.copyCreatePrompt.plan"
        locale={locale}
        warning={!mentorFiles.plan}
      />
      <FileSetting
        label={t("settings.spec", locale)}
        field="spec"
        value={mentorFiles.spec}
        createPrompt={t("settings.prompt.spec", locale)}
        buttonLabel={t("settings.createPrompt.spec", locale)}
        tooltipKey="settings.copyCreatePrompt.spec"
        locale={locale}
      />
      <div className="setting-item">
        <div className="setting-label" id="locale-toggle-label">
          {t("settings.language", locale)}
        </div>
        <label className="locale-toggle">
          <span
            aria-hidden="true"
            className={locale === "en" ? "locale-active" : ""}
          >
            English
          </span>
          <input
            type="checkbox"
            className="locale-checkbox"
            checked={locale === "ja"}
            onChange={() => onLocaleChange(locale === "ja" ? "en" : "ja")}
            aria-labelledby="locale-toggle-label"
          />
          <span
            aria-hidden="true"
            className={locale === "ja" ? "locale-active" : ""}
          >
            日本語
          </span>
        </label>
      </div>
      <div className="setting-separator" />
      <UninstallSection locale={locale} />
    </div>
  );
}
