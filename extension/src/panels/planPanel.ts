import * as vscode from "vscode";
import { BroadcastBus } from "../services/broadcastBus";
import type { PanelRequest } from "./protocol";
import { readSnapshot } from "./snapshot";
import * as planWrites from "./writes/planWrites";
import * as taskWrites from "./writes/taskWrites";

interface DbPaths {
  dbPath: string;
  wasmPath: string;
}

async function handleWrite(
  req: Exclude<PanelRequest, { type: "ready" } | { type: "openMarkdownFile" }>,
  dbPath: string,
  wasmPath: string,
): Promise<void> {
  switch (req.type) {
    case "reorderPlans":
      await planWrites.reorderPlans(
        dbPath,
        { orderedIds: req.orderedIds },
        wasmPath,
      );
      return;
    case "reorderTasks":
      await taskWrites.reorderTasks(
        dbPath,
        { planId: req.planId, orderedIds: req.orderedIds },
        wasmPath,
      );
      return;
    case "createPlan":
      await planWrites.createPlan(
        dbPath,
        { name: req.name, filePath: req.filePath },
        wasmPath,
      );
      return;
    case "updatePlan":
      if (req.status === "active") {
        await planWrites.activatePlan(dbPath, { id: req.id }, wasmPath);
      } else if (req.status === "queued") {
        // deactivatePlan sets status back to 'queued'
        await planWrites.deactivatePlan(dbPath, { id: req.id }, wasmPath);
      } else if (req.status === "paused" || req.status === "completed") {
        // No helper exists for these transitions; surface as unsupported (same pattern as updateTask status)
        throw new Error(`plan status '${req.status}' not supported via panel`);
      } else {
        // status is undefined — name/filePath-only update
        await planWrites.updatePlan(
          dbPath,
          { id: req.id, name: req.name, filePath: req.filePath },
          wasmPath,
        );
      }
      return;
    case "deletePlan":
      await planWrites.deletePlan(dbPath, { id: req.id }, wasmPath);
      return;
    case "createTask":
      await taskWrites.createTask(
        dbPath,
        { planId: req.planId, name: req.name },
        wasmPath,
      );
      return;
    case "updateTask":
      if (req.status !== undefined) {
        throw new Error("task status changes not supported via panel");
      }
      await taskWrites.updateTask(
        dbPath,
        { id: req.id, name: req.name },
        wasmPath,
      );
      return;
    case "deleteTask":
      await taskWrites.deleteTask(dbPath, { id: req.id }, wasmPath);
      return;
    default: {
      const _exhaustive: never = req;
      throw new Error(`unhandled request: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export class PlanPanel {
  /** Singleton instance — exposed for tests */
  static current: PlanPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly unregisterBus: () => void;
  private readonly dbPath: string;
  private readonly wasmPath: string;

  static createOrShow(
    context: vscode.ExtensionContext,
    bus: BroadcastBus,
    paths: DbPaths,
  ): void {
    if (PlanPanel.current) {
      PlanPanel.current.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    new PlanPanel(context, bus, paths);
  }

  private constructor(
    context: vscode.ExtensionContext,
    bus: BroadcastBus,
    paths: DbPaths,
  ) {
    this.dbPath = paths.dbPath;
    this.wasmPath = paths.wasmPath;

    this.panel = vscode.window.createWebviewPanel(
      "mentor-studio.planPanel",
      "Plan Panel",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
      },
    );

    // Register with BroadcastBus so DB-change events reach the webview
    this.unregisterBus = bus.register({
      postMessage: (m) => this.panel.webview.postMessage(m),
    });

    // Set the HTML content
    this.panel.webview.html = this.buildHtml(
      this.panel.webview,
      context.extensionUri,
    );

    // Message handler — the third arg (this.disposables) auto-tracks the disposable
    this.panel.webview.onDidReceiveMessage(
      async (raw: unknown) => {
        const req = raw as PanelRequest;
        switch (req.type) {
          case "ready":
            await this.sendInitData();
            return;
          case "openMarkdownFile":
            await vscode.commands.executeCommand(
              "vscode.open",
              vscode.Uri.file(req.filePath),
            );
            return;
          case "reorderPlans":
          case "reorderTasks":
          case "createPlan":
          case "updatePlan":
          case "deletePlan":
          case "createTask":
          case "updateTask":
          case "deleteTask":
            try {
              await handleWrite(req, this.dbPath, this.wasmPath);
              void this.panel.webview.postMessage({
                type: "writeOk",
                requestId: req.requestId,
              });
            } catch (e) {
              void this.panel.webview.postMessage({
                type: "writeError",
                requestId: req.requestId,
                error: e instanceof Error ? e.message : String(e),
              });
            }
            return;
        }
      },
      null,
      this.disposables,
    );

    // Cleanup on dispose
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    PlanPanel.current = this;
  }

  private async sendInitData(): Promise<void> {
    const snapshot = await readSnapshot(this.dbPath, this.wasmPath);
    void this.panel.webview.postMessage({ type: "initData", ...snapshot });
  }

  private dispose(): void {
    PlanPanel.current = undefined;
    this.unregisterBus();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }

  private buildHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "plan-panel.js"),
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src ${webview.cspSource};">
  <title>Plan Panel</title>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
