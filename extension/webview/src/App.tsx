import type {
  DashboardData,
  ExtensionMessage,
  Locale,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useEffect, useRef, useState } from "react";
import { Actions } from "./components/Actions";
import { ActionsIcon, OverviewIcon, SettingsIcon } from "./components/icons";
import { Overview } from "./components/Overview";
import { Settings } from "./components/Settings";
import { t } from "./i18n";
import { onMessage, postMessage } from "./vscodeApi";

type Tab = "actions" | "overview" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("actions");
  const [data, setData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<MentorStudioConfig | null>(null);
  const [hasConfig, setHasConfig] = useState(true);
  const [locale, setLocale] = useState<Locale>("ja");
  const [enableMentor, setEnableMentor] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [narrow, setNarrow] = useState(false);
  const [addTopicError, setAddTopicError] = useState<string | null>(null);
  const [lastAddedTopicKey, setLastAddedTopicKey] = useState<string | null>(
    null,
  );
  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < 250);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const settingsHasWarning =
    !config?.mentorFiles?.plan || !data?.profileLastUpdated;

  useEffect(() => {
    const cleanup = onMessage((message: ExtensionMessage) => {
      switch (message.type) {
        case "update":
          setData(message.data);
          break;
        case "config":
          setConfig(message.data);
          setHasConfig(true);
          if (message.data.locale) {
            setLocale(message.data.locale);
          }
          setEnableMentor(message.data.enableMentor ?? true);
          break;
        case "noConfig":
          setHasConfig(false);
          setLocale(message.locale ?? locale);
          break;
        case "addTopicResult":
          if (message.ok && message.key) {
            setAddTopicError(null);
            setLastAddedTopicKey(message.key);
          } else {
            setAddTopicError(message.error ?? t("app.addTopicFailed", locale));
            setLastAddedTopicKey(null);
          }
          break;
      }
    });

    postMessage({ type: "ready" });
    return cleanup;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = () => setMenuOpen(false);
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [menuOpen]);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    postMessage({ type: "setLocale", locale: newLocale });
  };

  const handleEnableMentorChange = (value: boolean) => {
    setEnableMentor(value);
    postMessage({ type: "setEnableMentor", value });
  };

  if (!hasConfig) {
    return (
      <div className="no-config">
        <p>
          <code>.mentor-studio.json</code> {t("app.noConfig.notFound", locale)}
        </p>
        <p>{t("app.noConfig.instruction", locale)}</p>
        <button
          className="btn-primary"
          onClick={() => postMessage({ type: "runSetup" })}
        >
          {t("app.noConfig.button", locale)}
        </button>
        <p className="no-config-hint">{t("app.noConfig.hint", locale)}</p>
      </div>
    );
  }

  return (
    <div className="app" ref={appRef}>
      <nav className="tabs">
        {narrow ? (
          <>
            <button
              className="hamburger-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              aria-label={t("app.menu", locale)}
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              {settingsHasWarning && <span className="hamburger-badge">!</span>}
            </button>
            {menuOpen && (
              <div className="hamburger-menu">
                {(["actions", "overview", "settings"] as Tab[]).map((t_) => (
                  <button
                    key={t_}
                    className={`hamburger-item${tab === t_ ? " active" : ""}`}
                    onClick={() => {
                      setTab(t_);
                      setMenuOpen(false);
                    }}
                  >
                    {t_ === "actions" && <ActionsIcon />}
                    {t_ === "overview" && <OverviewIcon />}
                    {t_ === "settings" && <SettingsIcon />}
                    <span>{t(`app.tab.${t_}`, locale)}</span>
                    {t_ === "settings" && settingsHasWarning && (
                      <span className="hamburger-item-badge">!</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="tabs-buttons">
            <button
              className={tab === "actions" ? "active" : ""}
              onClick={() => setTab("actions")}
            >
              <ActionsIcon />
              <span>{t("app.tab.actions", locale)}</span>
            </button>
            <button
              className={tab === "overview" ? "active" : ""}
              onClick={() => setTab("overview")}
            >
              <OverviewIcon />
              <span>{t("app.tab.overview", locale)}</span>
            </button>
            <button
              className={tab === "settings" ? "active" : ""}
              onClick={() => setTab("settings")}
            >
              <span className="tab-btn-inner">
                <SettingsIcon />
                <span>{t("app.tab.settings", locale)}</span>
                {settingsHasWarning && <span className="tab-badge">!</span>}
              </span>
            </button>
          </div>
        )}
        <div className="tabs-mentor">
          <span className="tabs-mentor-label">
            {t("settings.enableMentor", locale)}
          </span>
          <label className="mentor-toggle">
            <span className={!enableMentor ? "mentor-toggle-active" : ""}>
              OFF
            </span>
            <input
              type="checkbox"
              className="toggle-checkbox"
              checked={enableMentor}
              onChange={() => handleEnableMentorChange(!enableMentor)}
            />
            <span className={enableMentor ? "mentor-toggle-active" : ""}>
              ON
            </span>
          </label>
        </div>
      </nav>
      <main className="content">
        {tab === "actions" && <Actions locale={locale} />}
        {tab === "overview" && (
          <Overview
            data={data}
            locale={locale}
            config={config}
            addTopicError={addTopicError}
            lastAddedTopicKey={lastAddedTopicKey}
            onClearLastAddedKey={() => setLastAddedTopicKey(null)}
          />
        )}
        {tab === "settings" && (
          <Settings
            config={config}
            locale={locale}
            onLocaleChange={handleLocaleChange}
            profileLastUpdated={data?.profileLastUpdated ?? null}
          />
        )}
      </main>
      <footer className="status">
        {data
          ? t("app.status.loaded", locale)
          : t("app.status.loading", locale)}
      </footer>
    </div>
  );
}
