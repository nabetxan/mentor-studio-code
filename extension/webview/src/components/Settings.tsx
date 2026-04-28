import type {
  CleanupOptions,
  FileField,
  Locale,
  MentorStudioConfig,
  PlanDto,
} from "@mentor-studio/shared";
import { useState } from "react";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import type { TranslationKey } from "../i18n";
import { t } from "../i18n";
import { postMessage } from "../vscodeApi";
import {
  CheckIcon,
  CopyIcon,
  FolderIcon,
  OpenPanelIcon,
  SparkleIcon,
} from "./icons";

interface SettingsProps {
  config: MentorStudioConfig | null;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  profileLastUpdated: string | null;
  activePlan: PlanDto | null;
  nextPlan: PlanDto | null;
  planActionError: string | null;
  dataLocation?: { dbPath: string; dirPath: string };
}

interface ActivePlanRowProps {
  activePlan: PlanDto | null;
  locale: Locale;
  planActionError: string | null;
}

function ActivePlanRow({
  activePlan,
  locale,
  planActionError,
}: ActivePlanRowProps) {
  const [copiedKey, triggerCopy] = useCopyFeedback();
  const copied = copiedKey !== null;

  const handleCopyPrompt = () => {
    postMessage({ type: "copy", text: t("settings.prompt.plan", locale) });
    triggerCopy("copied");
  };

  if (!activePlan) {
    return (
      <div className="plan-row">
        <div className="setting-label-row">
          <div className="plan-row-prefix">
            {t("settings.plan.activeLabel", locale)}
          </div>
          <span className="setting-warning">{t("settings.unset", locale)}</span>
        </div>
        <div className="plan-row-body setting-unset">
          <div className="setting-actions-vertical">
            <button
              className="btn-primary"
              onClick={() => postMessage({ type: "selectFile", field: "plan" })}
            >
              {t("settings.selectFile", locale)}
            </button>
            <button
              className="snippet-btn"
              onClick={handleCopyPrompt}
              data-tooltip={t("settings.copyCreatePrompt.plan", locale)}
            >
              <span className="snippet-title">
                {t("settings.createPrompt.plan", locale)}
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
                  <SparkleIcon />
                )}
              </span>
            </button>
          </div>
          {planActionError && (
            <p className="setting-warning" role="alert">
              {planActionError}
            </p>
          )}
        </div>
      </div>
    );
  }

  const { id, filePath } = activePlan;

  return (
    <div className="plan-row">
      <div className="plan-row-prefix">
        {t("settings.plan.activeLabel", locale)}
      </div>
      <div className="plan-row-body setting-value">
        {filePath ? (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              postMessage({ type: "openFile", relativePath: filePath });
            }}
            className="file-path-link"
            title={filePath}
          >
            {filePath}
          </a>
        ) : (
          <span className="file-path-link muted">
            {t("settings.activePlan.uiOnly", locale)}
          </span>
        )}
        <div className="setting-actions">
          <button
            className="btn-primary"
            onClick={() => postMessage({ type: "changeActivePlanFile" })}
          >
            {t("settings.change", locale)}
          </button>
          <button
            className="btn-outlined"
            onClick={() => postMessage({ type: "pauseActivePlan", id })}
          >
            {t("settings.detach", locale)}
          </button>
        </div>
        {planActionError && (
          <p className="setting-warning" role="alert">
            {planActionError}
          </p>
        )}
      </div>
    </div>
  );
}

interface NextPlanRowProps {
  nextPlan: PlanDto;
  showActivateButton: boolean;
  locale: Locale;
}

function NextPlanRow({
  nextPlan,
  showActivateButton,
  locale,
}: NextPlanRowProps) {
  const { id, filePath } = nextPlan;
  return (
    <div className="plan-row">
      <div className="plan-row-prefix">
        {t("settings.plan.nextLabel", locale)}
      </div>
      <div className="plan-row-body setting-value">
        {filePath ? (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              postMessage({ type: "openFile", relativePath: filePath });
            }}
            className="file-path-link"
            title={filePath}
          >
            {filePath}
          </a>
        ) : (
          <span className="file-path-link muted">
            {t("settings.activePlan.uiOnly", locale)}
          </span>
        )}
        {showActivateButton && (
          <div className="setting-actions">
            <button
              className="btn-primary"
              onClick={() => postMessage({ type: "activatePlan", id })}
            >
              {t("settings.activePlan.activate", locale)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface PlanSectionProps {
  activePlan: PlanDto | null;
  nextPlan: PlanDto | null;
  locale: Locale;
  planActionError: string | null;
}

function PlanSection({
  activePlan,
  nextPlan,
  locale,
  planActionError,
}: PlanSectionProps) {
  const warning = !activePlan;
  return (
    <div className={`setting-item${warning ? " setting-item--warning" : ""}`}>
      {warning && (
        <span className="setting-warning-badge" aria-hidden="true">
          !
        </span>
      )}
      <div className="plan-section-header">
        <div className="setting-label">
          {t("settings.plan.section", locale)}
        </div>
        <button
          className="btn-outlined btn-with-icon"
          onClick={() => postMessage({ type: "openPlanPanel" })}
        >
          {t("settings.planPanel.openButton", locale)}
          <OpenPanelIcon />
        </button>
      </div>
      <ActivePlanRow
        activePlan={activePlan}
        locale={locale}
        planActionError={planActionError}
      />
      {nextPlan && (
        <NextPlanRow
          nextPlan={nextPlan}
          showActivateButton={!activePlan}
          locale={locale}
        />
      )}
    </div>
  );
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

function DataLocationSection({
  locale,
  dbPath,
  dirPath,
}: {
  locale: Locale;
  dbPath: string;
  dirPath: string;
}) {
  return (
    <section className="setting-item data-location">
      <div className="setting-label data-location-title">
        {t("settings.dataLocation.title", locale)}
      </div>
      <p className="setting-remove-description data-location-description">
        {t("settings.dataLocation.description", locale)}
      </p>
      <code className="data-location-path">{dbPath}</code>
      <div className="data-location-actions">
        <button
          type="button"
          className="btn-outlined btn-with-icon"
          onClick={() =>
            postMessage({ type: "openDataLocation", path: dirPath })
          }
        >
          {t("settings.dataLocation.open", locale)}
          <FolderIcon />
        </button>
      </div>
    </section>
  );
}

function UninstallSection({
  locale,
  dataLocation,
}: {
  locale: Locale;
  dataLocation?: { dirPath: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const [checks, setChecks] = useState<CleanupOptions>({
    mentorFolder: false,
    profile: true,
    claudeMdRef: true,
    wipeExternalDb: false,
  });

  const toggle = (key: keyof CleanupOptions) =>
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasSelection =
    checks.mentorFolder ||
    checks.profile ||
    checks.claudeMdRef ||
    checks.wipeExternalDb;

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
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded
          ? t("settings.uninstall.hideDetails", locale)
          : t("settings.uninstall.showDetails", locale)}
      </button>
      {expanded && (
        <div className="uninstall-details">
          <div className="uninstall-step">
            <div className="uninstall-step-title">
              {t("settings.uninstall.step1.title", locale)}
            </div>
            <p className="uninstall-step-description">
              {t("settings.uninstall.step1.description", locale)}
            </p>
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
            <label className="uninstall-check">
              <input
                type="checkbox"
                checked={checks.mentorFolder}
                onChange={() => toggle("mentorFolder")}
              />
              {t("settings.uninstall.check.mentorFolder", locale)}
            </label>
            {dataLocation && (
              <label className="uninstall-check">
                <input
                  type="checkbox"
                  checked={checks.wipeExternalDb}
                  onChange={() => toggle("wipeExternalDb")}
                />
                <span>
                  {t("settings.uninstall.check.externalDb", locale)}
                  <code className="uninstall-check-path">
                    {dataLocation.dirPath}
                  </code>
                </span>
              </label>
            )}
            {(checks.mentorFolder || checks.wipeExternalDb) && (
              <p className="uninstall-warning">
                {t(
                  checks.wipeExternalDb
                    ? "settings.uninstall.warning.dataLoss"
                    : "settings.uninstall.warning.basic",
                  locale,
                )}
              </p>
            )}
            <button
              className="btn-remove"
              disabled={!hasSelection}
              onClick={handleCleanup}
            >
              {t("settings.uninstall.cleanup", locale)}
            </button>
          </div>
          <div className="uninstall-step">
            <div className="uninstall-step-title">
              {t("settings.uninstall.step2.title", locale)}
            </div>
            <p className="uninstall-step-description">
              {t("settings.uninstall.step2.description", locale)}
            </p>
            <button
              className="btn-secondary"
              onClick={() => postMessage({ type: "openExtensionsView" })}
            >
              {t("settings.uninstall.step2.button", locale)}
            </button>
          </div>
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
  activePlan,
  nextPlan,
  planActionError,
  dataLocation,
}: SettingsProps) {
  const mentorFiles = config?.mentorFiles ?? {
    spec: null,
    plan: null,
  };

  return (
    <div className="settings">
      <ProfileSection profileLastUpdated={profileLastUpdated} locale={locale} />
      <p className="setting-guide">{t("settings.unsetGuide", locale)}</p>
      <PlanSection
        activePlan={activePlan}
        nextPlan={nextPlan}
        locale={locale}
        planActionError={planActionError}
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
      <div className="setting-item">
        <div className="uninstall-title">
          {t("settings.setup.title", locale)}
        </div>
        <p className="setting-remove-description">
          {t("settings.setup.description", locale)}
        </p>
        <button
          className="btn-primary"
          onClick={() => postMessage({ type: "runSetup" })}
        >
          {t("settings.setup.button", locale)}
        </button>
      </div>
      <div className="setting-separator" />
      {dataLocation && (
        <DataLocationSection
          locale={locale}
          dbPath={dataLocation.dbPath}
          dirPath={dataLocation.dirPath}
        />
      )}
      <UninstallSection locale={locale} dataLocation={dataLocation} />
    </div>
  );
}
