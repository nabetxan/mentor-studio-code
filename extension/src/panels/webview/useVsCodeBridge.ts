import type { PlanDto, TaskDto, TopicDto } from "@mentor-studio/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PanelMessage, PanelRequest } from "../protocol";

// VS Code webview API shape (the subset we use).
interface VsCodeApi {
  postMessage(msg: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

/** Request without the requestId — the bridge fills it in. */
export type BridgeRequest =
  | Omit<Extract<PanelRequest, { type: "reorderPlans" }>, "requestId">
  | Omit<Extract<PanelRequest, { type: "createPlan" }>, "requestId">
  | Omit<Extract<PanelRequest, { type: "updatePlan" }>, "requestId">
  | Omit<Extract<PanelRequest, { type: "removePlan" }>, "requestId">
  | Omit<Extract<PanelRequest, { type: "restorePlan" }>, "requestId">;

export interface Snapshot {
  plans: PlanDto[];
  tasks: TaskDto[];
  topics: TopicDto[];
}

export interface Bridge {
  ready: boolean;
  snapshot: Snapshot;
  sendRequest: (req: BridgeRequest) => Promise<void>;
  pickPlanFile: () => Promise<string | null>;
  openFile: (filePath: string) => void;
  refetch: () => void;
}

let requestIdCounter = 0;
function nextRequestId(): string {
  requestIdCounter += 1;
  return `req-${Date.now()}-${requestIdCounter}`;
}

function getApi(): VsCodeApi | null {
  if (typeof window === "undefined") return null;
  if (!window.acquireVsCodeApi) return null;
  // acquireVsCodeApi can only be called once per webview; cache it.
  const w = window as Window & { __vsCodeApi?: VsCodeApi };
  if (!w.__vsCodeApi) {
    w.__vsCodeApi = window.acquireVsCodeApi();
  }
  return w.__vsCodeApi;
}

export function useVsCodeBridge(): Bridge {
  const apiRef = useRef<VsCodeApi | null>(null);
  if (apiRef.current === null) {
    apiRef.current = getApi();
  }

  const [snapshot, setSnapshot] = useState<Snapshot>({
    plans: [],
    tasks: [],
    topics: [],
  });
  const [ready, setReady] = useState(false);

  // Pending write resolvers (void) keyed by requestId
  const pendingWritesRef = useRef<
    Map<string, { resolve: () => void; reject: (e: Error) => void }>
  >(new Map());
  // Pending pickPlanFile resolvers (string | null) keyed by requestId
  const pendingPicksRef = useRef<
    Map<
      string,
      {
        resolve: (filePath: string | null) => void;
        reject: (e: Error) => void;
      }
    >
  >(new Map());

  const post = useCallback((msg: PanelRequest) => {
    apiRef.current?.postMessage(msg);
  }, []);

  const refetch = useCallback(() => {
    post({ type: "ready" });
  }, [post]);

  useEffect(() => {
    function handle(ev: MessageEvent<PanelMessage>): void {
      const msg = ev.data;
      if (!msg || typeof msg !== "object") return;
      switch (msg.type) {
        case "initData":
          setSnapshot({
            plans: msg.plans,
            tasks: msg.tasks,
            topics: msg.topics,
          });
          setReady(true);
          return;
        case "dbChanged":
          // Ask for a fresh snapshot
          post({ type: "ready" });
          return;
        case "writeOk": {
          const entry = pendingWritesRef.current.get(msg.requestId);
          if (entry) {
            pendingWritesRef.current.delete(msg.requestId);
            entry.resolve();
          }
          return;
        }
        case "writeError": {
          const write = pendingWritesRef.current.get(msg.requestId);
          if (write) {
            pendingWritesRef.current.delete(msg.requestId);
            write.reject(new Error(msg.error));
            return;
          }
          const pick = pendingPicksRef.current.get(msg.requestId);
          if (pick) {
            pendingPicksRef.current.delete(msg.requestId);
            pick.reject(new Error(msg.error));
          }
          return;
        }
        case "pickPlanFileResult": {
          const entry = pendingPicksRef.current.get(msg.requestId);
          if (entry) {
            pendingPicksRef.current.delete(msg.requestId);
            entry.resolve(msg.filePath);
          }
          return;
        }
      }
    }
    window.addEventListener("message", handle);
    // Tell the extension we're ready to receive initData
    post({ type: "ready" });
    return () => {
      window.removeEventListener("message", handle);
    };
  }, [post]);

  const sendRequest = useCallback(
    (req: BridgeRequest): Promise<void> => {
      const requestId = nextRequestId();
      return new Promise<void>((resolve, reject) => {
        pendingWritesRef.current.set(requestId, { resolve, reject });
        post({ ...req, requestId } as PanelRequest);
      });
    },
    [post],
  );

  const pickPlanFile = useCallback((): Promise<string | null> => {
    const requestId = nextRequestId();
    return new Promise<string | null>((resolve, reject) => {
      pendingPicksRef.current.set(requestId, { resolve, reject });
      post({ type: "pickPlanFile", requestId });
    });
  }, [post]);

  const openFile = useCallback(
    (filePath: string) => {
      post({ type: "openMarkdownFile", filePath });
    },
    [post],
  );

  return useMemo(
    () => ({ ready, snapshot, sendRequest, pickPlanFile, openFile, refetch }),
    [ready, snapshot, sendRequest, pickPlanFile, openFile, refetch],
  );
}
