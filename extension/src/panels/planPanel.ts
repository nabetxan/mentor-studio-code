import type { Locale, PlanStatus } from "@mentor-studio/shared";
import * as path from "node:path";
import * as vscode from "vscode";
import { BroadcastBus } from "../services/broadcastBus";
import { toWorkspaceRelative } from "../utils/workspacePath";
import type { PanelRequest } from "./protocol";
import { readConfigLocale } from "./readConfigLocale";
import { readSnapshot } from "./snapshot";
import * as planWrites from "./writes/planWrites";

interface DbPaths {
  dbPath: string;
  wasmPath: string;
  workspaceRoot: string;
}

/** Hook called after any successful Plan Panel write. Wired by extension.ts
 *  to (a) refresh the sidebar dashboard and (b) broadcast `dbChanged` so the
 *  panel's own webview re-fetches a fresh snapshot — mirroring the flow that
 *  `FileWatcherService.notifyWrite()` runs for sidebar-initiated writes. */
export type AfterWriteHook = () => void | Promise<void>;

async function handleWrite(
  req: Exclude<
    PanelRequest,
    | { type: "ready" }
    | { type: "openMarkdownFile" }
    | { type: "pickPlanFile" }
    | { type: "setPlanStatus" }
  >,
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
    case "createPlan":
      await planWrites.addPlanToBacklog(
        dbPath,
        { name: req.name, filePath: req.filePath },
        wasmPath,
      );
      return;
    case "updatePlan":
      await planWrites.updatePlan(
        dbPath,
        { id: req.id, name: req.name, filePath: req.filePath },
        wasmPath,
      );
      return;
    case "removePlan":
      await planWrites.removePlan(dbPath, { id: req.id }, wasmPath);
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
  private readonly workspaceRoot: string;
  private readonly onAfterWrite?: AfterWriteHook;
  private readonly inFlight = new Map<number, Promise<void>>();
  private cachedLocale: Locale = "en";

  static createOrShow(
    context: vscode.ExtensionContext,
    bus: BroadcastBus,
    paths: DbPaths,
    onAfterWrite?: AfterWriteHook,
  ): void {
    if (PlanPanel.current) {
      PlanPanel.current.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    new PlanPanel(context, bus, paths, onAfterWrite);
  }

  private constructor(
    context: vscode.ExtensionContext,
    bus: BroadcastBus,
    paths: DbPaths,
    onAfterWrite?: AfterWriteHook,
  ) {
    this.dbPath = paths.dbPath;
    this.wasmPath = paths.wasmPath;
    this.workspaceRoot = paths.workspaceRoot;
    this.onAfterWrite = onAfterWrite;

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
          case "openMarkdownFile": {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            const uri = path.isAbsolute(req.filePath)
              ? vscode.Uri.file(req.filePath)
              : wsRoot
                ? vscode.Uri.joinPath(wsRoot, req.filePath)
                : vscode.Uri.file(req.filePath);
            try {
              await vscode.window.showTextDocument(uri, { preview: true });
            } catch (e) {
              const detail = e instanceof Error ? e.message : String(e);
              void vscode.window.showErrorMessage(
                `Failed to open ${req.filePath}: ${detail}`,
              );
            }
            return;
          }
          case "pickPlanFile": {
            const picked = await vscode.window.showOpenDialog({
              canSelectMany: false,
              filters: { Markdown: ["md"] },
            });
            const filePath =
              picked && picked.length > 0
                ? toWorkspaceRelative(picked[0], this.cachedLocale === "ja")
                : null;
            void this.panel.webview.postMessage({
              type: "pickPlanFileResult",
              requestId: req.requestId,
              filePath,
            });
            return;
          }
          case "setPlanStatus": {
            if (this.inFlight.has(req.id)) {
              void this.panel.webview.postMessage({
                type: "writeError",
                requestId: req.requestId,
                error: "busy",
              });
              return;
            }
            const promise = this.handleSetPlanStatus(
              req.id,
              req.toStatus,
              req.requestId,
            );
            this.inFlight.set(req.id, promise);
            void promise.finally(() => {
              this.inFlight.delete(req.id);
              void this.runAfterWrite();
            });
            await promise;
            return;
          }
          case "reorderPlans":
          case "createPlan":
          case "updatePlan":
          case "removePlan":
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
            } finally {
              void this.runAfterWrite();
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
    this.cachedLocale = await readConfigLocale(this.workspaceRoot);
    void this.panel.webview.postMessage({
      type: "initData",
      ...snapshot,
      locale: this.cachedLocale,
    });
  }

  private async runAfterWrite(): Promise<void> {
    if (!this.onAfterWrite) return;
    try {
      await this.onAfterWrite();
    } catch {
      // Hook is fire-and-forget — swallow errors to avoid disturbing the write flow.
    }
  }

  private async handleSetPlanStatus(
    id: number,
    toStatus: PlanStatus,
    requestId: string,
  ): Promise<void> {
    try {
      if (toStatus === "active") {
        const snap = await readSnapshot(this.dbPath, this.wasmPath);
        const currentActive = snap.plans.find((p) => p.status === "active");
        if (currentActive && currentActive.id !== id) {
          const targetPlan = snap.plans.find((p) => p.id === id);
          const targetName = targetPlan?.name ?? `Plan ${id}`;
          const msg =
            this.cachedLocale === "ja"
              ? `「${currentActive.name}」が現在のアクティブプランです。代わりに「${targetName}」をアクティブにしますか？（${currentActive.name} は待機に戻ります）`
              : `"${currentActive.name}" is currently active. Activate "${targetName}" instead? "${currentActive.name}" will be moved to queued.`;
          const choice = await vscode.window.showInformationMessage(
            msg,
            "Activate",
            "Cancel",
          );
          if (choice !== "Activate") {
            void this.panel.webview.postMessage({ type: "writeOk", requestId });
            return;
          }
        }
        await planWrites.activatePlan(this.dbPath, { id }, this.wasmPath);
      } else if (toStatus === "removed") {
        const snap = await readSnapshot(this.dbPath, this.wasmPath);
        const plan = snap.plans.find((p) => p.id === id);
        if (plan?.status === "active") {
          await planWrites.deactivatePlan(this.dbPath, { id }, this.wasmPath);
        }
        await planWrites.removePlan(this.dbPath, { id }, this.wasmPath);
      } else if (
        toStatus === "queued" ||
        toStatus === "paused" ||
        toStatus === "backlog" ||
        toStatus === "completed"
      ) {
        // Single-transaction transition. changeStatus sets the row's status
        // directly; if the plan is currently 'active', the partial unique index
        // on status='active' allows going to a non-active state in one UPDATE
        // and assertStatusInvariants runs inside the same tx — so either the
        // whole transition succeeds or nothing changes.
        await planWrites.changeStatus(
          this.dbPath,
          { id, toStatus },
          this.wasmPath,
        );
      } else {
        const _exhaustive: never = toStatus;
        throw new Error(`unhandled toStatus: ${String(_exhaustive)}`);
      }
      void this.panel.webview.postMessage({ type: "writeOk", requestId });
    } catch (e) {
      void this.panel.webview.postMessage({
        type: "writeError",
        requestId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
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
