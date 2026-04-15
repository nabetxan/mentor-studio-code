// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelMessage, PanelRequest } from "../../../src/panels/protocol";
import { App } from "../../../src/panels/webview/App";

interface FakeApi {
  postMessage: (msg: PanelRequest) => void;
}

let posted: PanelRequest[] = [];

function simulateIncoming(msg: PanelMessage): void {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: msg }));
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function lastRequestId(filter?: PanelRequest["type"]): string {
  const list = filter ? posted.filter((p) => p.type === filter) : posted;
  const req = list[list.length - 1];
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
  vi.restoreAllMocks();
});

function loadInitialData(): void {
  simulateIncoming({
    type: "initData",
    plans: [
      {
        id: 1,
        name: "Plan A",
        filePath: "/work/a.md",
        status: "active",
        sortOrder: 1,
      },
      {
        id: 2,
        name: "Plan B",
        filePath: null,
        status: "queued",
        sortOrder: 2,
      },
    ],
    tasks: [],
    topics: [],
  });
}

describe("App <Plan Panel>", () => {
  it("posts 'ready' on mount", () => {
    render(<App />);
    expect(posted[0]).toEqual({ type: "ready" });
  });

  it("renders plans after initData", () => {
    render(<App />);
    loadInitialData();
    expect(screen.getByText("Plan A")).toBeTruthy();
    expect(screen.getByText("Plan B")).toBeTruthy();
  });

  it("Add Plan from File button posts pickPlanFile, then createPlan with basename", async () => {
    render(<App />);
    loadInitialData();

    fireEvent.click(screen.getByTestId("plan-add-from-file"));
    const pickReq = posted.find((p) => p.type === "pickPlanFile");
    expect(pickReq).toBeDefined();

    // Server responds with a file path
    simulateIncoming({
      type: "pickPlanFileResult",
      requestId: lastRequestId("pickPlanFile"),
      filePath: "/work/plans/my-plan.md",
    });
    await flush();

    const createReq = posted.find((p) => p.type === "createPlan") as
      | Extract<PanelRequest, { type: "createPlan" }>
      | undefined;
    expect(createReq).toBeDefined();
    expect(createReq?.name).toBe("my-plan");
    expect(createReq?.filePath).toBe("/work/plans/my-plan.md");

    // Optimistic tentative row
    expect(screen.getByText("my-plan")).toBeTruthy();

    simulateIncoming({
      type: "writeOk",
      requestId: lastRequestId("createPlan"),
    });
    await flush();
    expect(screen.queryByText("my-plan")).toBeNull();
  });

  it("Add Plan from File with null result does NOT post createPlan", async () => {
    render(<App />);
    loadInitialData();
    fireEvent.click(screen.getByTestId("plan-add-from-file"));
    simulateIncoming({
      type: "pickPlanFileResult",
      requestId: lastRequestId("pickPlanFile"),
      filePath: null,
    });
    await flush();
    expect(posted.find((p) => p.type === "createPlan")).toBeUndefined();
  });

  it("Activate on a queued plan posts updatePlan status=active", () => {
    render(<App />);
    loadInitialData();
    const toggles = screen.getAllByTestId("plan-toggle-active");
    // index 1 = Plan B queued
    fireEvent.click(toggles[1]!);
    const req = posted.find((p) => p.type === "updatePlan" && p.id === 2) as
      | Extract<PanelRequest, { type: "updatePlan" }>
      | undefined;
    expect(req?.status).toBe("active");
  });

  it("Deactivate on active plan posts updatePlan status=queued", () => {
    render(<App />);
    loadInitialData();
    const toggles = screen.getAllByTestId("plan-toggle-active");
    fireEvent.click(toggles[0]!);
    const req = posted.find((p) => p.type === "updatePlan" && p.id === 1) as
      | Extract<PanelRequest, { type: "updatePlan" }>
      | undefined;
    expect(req?.status).toBe("queued");
  });

  it("Remove plan posts removePlan and optimistically hides the row", () => {
    render(<App />);
    loadInitialData();
    const dels = screen.getAllByTestId("plan-remove");
    fireEvent.click(dels[1]!);
    expect(screen.queryByText("Plan B")).toBeNull();
    const req = posted.find((p) => p.type === "removePlan");
    expect(req).toMatchObject({ type: "removePlan", id: 2 });
  });

  it("rolls back optimistic remove on writeError", async () => {
    render(<App />);
    loadInitialData();
    const dels = screen.getAllByTestId("plan-remove");
    fireEvent.click(dels[1]!);
    expect(screen.queryByText("Plan B")).toBeNull();

    const reqId = lastRequestId("removePlan");
    simulateIncoming({
      type: "writeError",
      requestId: reqId,
      error: "FK fail",
    });
    await flush();

    expect(screen.getByText("Plan B")).toBeTruthy();
    expect(screen.getByText("FK fail")).toBeTruthy();
  });

  it("Restore on removed plan posts restorePlan with toStatus=backlog", async () => {
    render(<App />);
    simulateIncoming({
      type: "initData",
      plans: [
        {
          id: 5,
          name: "Plan Gone",
          filePath: null,
          status: "removed",
          sortOrder: 1,
        },
      ],
      tasks: [],
      topics: [],
    });
    fireEvent.click(screen.getByLabelText("show removed"));
    fireEvent.click(screen.getByTestId("plan-restore"));
    const req = posted.find((p) => p.type === "restorePlan") as
      | Extract<PanelRequest, { type: "restorePlan" }>
      | undefined;
    expect(req).toBeDefined();
    expect(req?.id).toBe(5);
    expect(req?.toStatus).toBe("backlog");
  });

  it("dbChanged triggers a fresh 'ready' post", () => {
    render(<App />);
    loadInitialData();
    posted = [];
    simulateIncoming({ type: "dbChanged" });
    expect(posted).toContainEqual({ type: "ready" });
  });

  it("open file button posts openMarkdownFile", () => {
    render(<App />);
    loadInitialData();
    const openBtns = screen.getAllByLabelText("open plan file");
    fireEvent.click(openBtns[0]!);
    expect(posted).toContainEqual({
      type: "openMarkdownFile",
      filePath: "/work/a.md",
    });
  });

  it("rolls back optimistic create on writeError", async () => {
    render(<App />);
    loadInitialData();

    fireEvent.click(screen.getByTestId("plan-add-from-file"));
    simulateIncoming({
      type: "pickPlanFileResult",
      requestId: lastRequestId("pickPlanFile"),
      filePath: "/work/bad.md",
    });
    await flush();

    expect(screen.getByText("bad")).toBeTruthy();
    const reqId = lastRequestId("createPlan");
    simulateIncoming({
      type: "writeError",
      requestId: reqId,
      error: "nope",
    });
    await flush();

    expect(screen.queryByText("bad")).toBeNull();
    expect(screen.getByText("nope")).toBeTruthy();
  });
});
