// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PanelMessage, PanelRequest } from "../../../src/panels/protocol";
import { useVsCodeBridge } from "../../../src/panels/webview/useVsCodeBridge";

interface FakeApi {
  postMessage: (msg: PanelRequest) => void;
}

let posted: PanelRequest[] = [];

function simulateIncoming(msg: PanelMessage): void {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: msg }));
  });
}

function lastRequestId(filter: PanelRequest["type"]): string {
  const req = [...posted].reverse().find((p) => p.type === filter);
  if (!req || !("requestId" in req)) throw new Error("no requestId");
  return req.requestId;
}

beforeEach(() => {
  posted = [];
  const api: FakeApi = {
    postMessage: (msg) => {
      posted.push(msg);
    },
  };
  const w = window as Window & {
    __vsCodeApi?: FakeApi;
    acquireVsCodeApi?: () => FakeApi;
  };
  w.__vsCodeApi = undefined;
  w.acquireVsCodeApi = () => api;
});

afterEach(() => {
  cleanup();
});

describe("useVsCodeBridge", () => {
  it("sendRequest posts removePlan with an injected requestId", async () => {
    const { result } = renderHook(() => useVsCodeBridge());
    let resolved = false;
    act(() => {
      void result.current
        .sendRequest({ type: "removePlan", id: 7 })
        .then(() => {
          resolved = true;
        });
    });
    const req = posted.find((p) => p.type === "removePlan") as
      | Extract<PanelRequest, { type: "removePlan" }>
      | undefined;
    expect(req).toBeDefined();
    expect(req?.id).toBe(7);
    expect(typeof req?.requestId).toBe("string");

    simulateIncoming({
      type: "writeOk",
      requestId: lastRequestId("removePlan"),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolved).toBe(true);
  });

  it("sendRequest posts setPlanStatus with toStatus", () => {
    const { result } = renderHook(() => useVsCodeBridge());
    act(() => {
      void result.current.sendRequest({
        type: "setPlanStatus",
        id: 3,
        toStatus: "backlog",
      });
    });
    const req = posted.find((p) => p.type === "setPlanStatus") as
      | Extract<PanelRequest, { type: "setPlanStatus" }>
      | undefined;
    expect(req).toBeDefined();
    expect(req?.id).toBe(3);
    expect(req?.toStatus).toBe("backlog");
  });

  it("pickPlanFile posts pickPlanFile and resolves with filePath on pickPlanFileResult", async () => {
    const { result } = renderHook(() => useVsCodeBridge());
    let resolved: string | null | undefined;
    act(() => {
      void result.current.pickPlanFile().then((fp) => {
        resolved = fp;
      });
    });
    const req = posted.find((p) => p.type === "pickPlanFile");
    expect(req).toBeDefined();

    simulateIncoming({
      type: "pickPlanFileResult",
      requestId: lastRequestId("pickPlanFile"),
      filePath: "/x/y.md",
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolved).toBe("/x/y.md");
  });

  it("pickPlanFile resolves null when user cancels", async () => {
    const { result } = renderHook(() => useVsCodeBridge());
    let resolved: string | null | undefined;
    act(() => {
      void result.current.pickPlanFile().then((fp) => {
        resolved = fp;
      });
    });
    simulateIncoming({
      type: "pickPlanFileResult",
      requestId: lastRequestId("pickPlanFile"),
      filePath: null,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolved).toBeNull();
  });

  it("initData updates the snapshot and marks ready", () => {
    const { result } = renderHook(() => useVsCodeBridge());
    expect(result.current.ready).toBe(false);
    simulateIncoming({
      type: "initData",
      plans: [
        {
          id: 1,
          name: "X",
          filePath: null,
          status: "backlog",
          sortOrder: 1,
        },
      ],
      tasks: [],
      topics: [],
      locale: "en",
    });
    expect(result.current.ready).toBe(true);
    expect(result.current.snapshot.plans).toHaveLength(1);
  });
});
