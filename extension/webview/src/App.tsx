import type { DashboardData, ExtensionMessage } from "@mentor-studio/shared";
import { useEffect, useState } from "react";
import { Actions } from "./components/Actions";
import { Overview } from "./components/Overview";
import { Topics } from "./components/Topics";
import { onMessage, postMessage } from "./vscodeApi";

type Tab = "overview" | "topics" | "actions";

export function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [hasConfig, setHasConfig] = useState(true);

  useEffect(() => {
    const cleanup = onMessage((message: ExtensionMessage) => {
      switch (message.type) {
        case "update":
          setData(message.data);
          break;
        case "config":
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
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={tab === "topics" ? "active" : ""}
          onClick={() => setTab("topics")}
        >
          Topics
        </button>
        <button
          className={tab === "actions" ? "active" : ""}
          onClick={() => setTab("actions")}
        >
          Actions
        </button>
      </nav>
      <main className="content">
        {tab === "overview" && <Overview data={data} />}
        {tab === "topics" && <Topics data={data} />}
        {tab === "actions" && <Actions data={data} />}
      </main>
      <footer className="status">
        {data ? "✓ Local data loaded" : "Loading..."}
      </footer>
    </div>
  );
}
