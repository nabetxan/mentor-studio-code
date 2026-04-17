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
      { id: 2, name: "Plan B", filePath: null, status: "queued", sortOrder: 2 },
    ],
    tasks: [],
    topics: [],
    locale: "en",
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
  });

  it("badge button click -> status menu -> select paused -> posts setPlanStatus", () => {
    render(<App />);
    loadInitialData();
    // Find Plan B's badge button (it's in the Queued group)
    const badges = screen.getAllByTestId("plan-status-btn");
    const planBBadge = badges.find((b) => b.textContent?.includes("Queued"));
    fireEvent.click(planBBadge!);
    const items = screen.getAllByRole("menuitem");
    const pausedItem = items.find((i) => i.textContent?.includes("Paused"));
    fireEvent.click(pausedItem!);
    const req = posted.find((p) => p.type === "setPlanStatus") as
      | Extract<PanelRequest, { type: "setPlanStatus" }>
      | undefined;
    expect(req).toBeDefined();
    expect(req?.id).toBe(2);
    expect(req?.toStatus).toBe("paused");
  });

  it("locale=ja is passed through context", () => {
    render(<App />);
    simulateIncoming({
      type: "initData",
      plans: [
        {
          id: 1,
          name: "Plan A",
          filePath: null,
          status: "queued",
          sortOrder: 1,
        },
      ],
      tasks: [],
      topics: [],
      locale: "ja",
    });
    const badge = screen.getByTestId("plan-status-btn");
    expect(badge.textContent).toContain("\u5F85\u6A5F");
  });

  it("missing locale in initData falls back to en", () => {
    render(<App />);
    simulateIncoming({
      type: "initData",
      plans: [
        {
          id: 1,
          name: "Plan A",
          filePath: null,
          status: "queued",
          sortOrder: 1,
        },
      ],
      tasks: [],
      topics: [],
    } as unknown as PanelMessage);
    const badge = screen.getByTestId("plan-status-btn");
    expect(badge.textContent).toContain("Queued");
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
});
