import type {
  DashboardData,
  ExtensionMessage,
  Locale,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useEffect, useState } from "react";
import { Actions } from "./components/Actions";
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
          break;
      }
    });

    postMessage({ type: "ready" });
    return cleanup;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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
          <code>.mentor-studio.json</code> {t("app.noConfig.line1", locale)}
        </p>
        <p>{t("app.noConfig.line2", locale)}</p>
        <button
          className="setup-btn"
          onClick={() => postMessage({ type: "runSetup" })}
        >
          {t("app.noConfig.setupButton", locale)}
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="tabs">
        <button
          className={tab === "actions" ? "active" : ""}
          onClick={() => setTab("actions")}
        >
          {t("app.tab.actions", locale)}
        </button>
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          {t("app.tab.overview", locale)}
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          onClick={() => setTab("settings")}
        >
          {t("app.tab.settings", locale)}
        </button>
      </nav>
      <main className="content">
        {tab === "actions" && <Actions locale={locale} />}
        {tab === "overview" && <Overview data={data} locale={locale} />}
        {tab === "settings" && (
          <Settings
            config={config}
            locale={locale}
            onLocaleChange={handleLocaleChange}
            enableMentor={enableMentor}
            onEnableMentorChange={handleEnableMentorChange}
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
