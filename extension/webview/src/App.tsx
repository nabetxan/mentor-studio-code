import type {
  DashboardData,
  ExtensionMessage,
  MentorStudioConfig,
} from "@mentor-studio/shared";
import { useEffect, useState } from "react";
import { Actions } from "./components/Actions";
import { Overview } from "./components/Overview";
import { Settings } from "./components/Settings";
import { onMessage, postMessage } from "./vscodeApi";

type Tab = "actions" | "overview" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("actions");
  const [data, setData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<MentorStudioConfig | null>(null);
  const [hasConfig, setHasConfig] = useState(true);

  useEffect(() => {
    const cleanup = onMessage((message: ExtensionMessage) => {
      switch (message.type) {
        case "update":
          setData(message.data);
          break;
        case "config":
          setConfig(message.data);
          setHasConfig(true);
          break;
        case "noConfig":
          setHasConfig(false);
          break;
      }
    });

    postMessage({ type: "ready" });
    return cleanup;
  }, []);

  if (!hasConfig) {
    return (
      <div className="no-config">
        <p>
          No <code>.mentor-studio.json</code> found.
        </p>
        <p>
          Run &quot;Mentor Studio: Setup Mentor&quot; from the command palette.
        </p>
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
          Actions
        </button>
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </nav>
      <main className="content">
        {tab === "actions" && <Actions />}
        {tab === "overview" && <Overview data={data} />}
        {tab === "settings" && <Settings config={config} />}
      </main>
      <footer className="status">
        {data ? "✓ Local data loaded" : "Loading..."}
      </footer>
    </div>
  );
}
