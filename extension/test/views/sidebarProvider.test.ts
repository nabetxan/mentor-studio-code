import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscodeMock from "../__mocks__/vscode";
import { SidebarProvider } from "../../src/views/sidebarProvider";

type MessageHandler = (msg: unknown) => void | Promise<void>;

interface FakeWebviewView {
  webview: {
    options: unknown;
    html: string;
    cspSource: string;
    onDidReceiveMessage: (h: MessageHandler) => vscodeMock.Disposable;
    postMessage: (msg: unknown) => Promise<boolean>;
    asWebviewUri: (u: vscodeMock.MockUri) => vscodeMock.MockUri;
  };
  onDidDispose: (h: () => void) => vscodeMock.Disposable;
  __trigger: (msg: unknown) => Promise<void>;
  __posted: unknown[];
}

function makeView(): FakeWebviewView {
  const posted: unknown[] = [];
  let handler: MessageHandler | null = null;
  return {
    webview: {
      options: undefined,
      html: "",
      cspSource: "vscode-resource:",
      onDidReceiveMessage: (h) => {
        handler = h;
        return new vscodeMock.Disposable();
      },
      postMessage: (msg) => {
        posted.push(msg);
        return Promise.resolve(true);
      },
      asWebviewUri: (u) => u,
    },
    onDidDispose: () => new vscodeMock.Disposable(),
    __trigger: async (msg) => {
      if (handler) await handler(msg);
    },
    __posted: posted,
  };
}

describe("SidebarProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getSubscriber() forwards messages to the webview", () => {
    const provider = new SidebarProvider(vscodeMock.Uri.file("/ext"));
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const sub = provider.getSubscriber();
    sub.postMessage({ type: "dbChanged" });
    expect(view.__posted).toContainEqual({ type: "dbChanged" });
  });

  it("getSubscriber() is a no-op when view is not yet resolved", () => {
    const provider = new SidebarProvider(vscodeMock.Uri.file("/ext"));
    const sub = provider.getSubscriber();
    expect(() => sub.postMessage({ type: "dbChanged" })).not.toThrow();
  });

  it("mergeTopic message calls the registered handler", async () => {
    const provider = new SidebarProvider(vscodeMock.Uri.file("/ext"));
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const mergeTopic = vi.fn(() => Promise.resolve());
    provider.setTopicHandlers({
      mergeTopic,
      updateTopicLabel: () => Promise.resolve(),
      addTopic: () => Promise.resolve({ ok: true, key: "t_1" }),
      deleteTopics: () => Promise.resolve([]),
    });
    await view.__trigger({
      type: "mergeTopic",
      fromKey: "t_1",
      toKey: "t_2",
    });
    expect(mergeTopic).toHaveBeenCalledWith("t_1", "t_2");
  });

  it("mergeTopic handler throw → showErrorMessage", async () => {
    const provider = new SidebarProvider(vscodeMock.Uri.file("/ext"));
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    const showError = vi
      .spyOn(vscodeMock.window, "showErrorMessage")
      .mockResolvedValue(undefined);
    provider.setTopicHandlers({
      mergeTopic: () => Promise.reject(new Error("boom")),
      updateTopicLabel: () => Promise.resolve(),
      addTopic: () => Promise.resolve({ ok: true, key: "t_1" }),
      deleteTopics: () => Promise.resolve([]),
    });
    await view.__trigger({
      type: "mergeTopic",
      fromKey: "t_1",
      toKey: "t_2",
    });
    expect(showError).toHaveBeenCalledTimes(1);
  });

  it("deleteTopics posts deleteTopicsResult with handler results", async () => {
    const provider = new SidebarProvider(vscodeMock.Uri.file("/ext"));
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    provider.setTopicHandlers({
      mergeTopic: () => Promise.resolve(),
      updateTopicLabel: () => Promise.resolve(),
      addTopic: () => Promise.resolve({ ok: true, key: "t_1" }),
      deleteTopics: (keys) =>
        Promise.resolve(keys.map((key) => ({ key, ok: true }))),
    });
    await view.__trigger({ type: "deleteTopics", keys: ["t_1", "t_2"] });
    expect(view.__posted).toContainEqual({
      type: "deleteTopicsResult",
      results: [
        { key: "t_1", ok: true },
        { key: "t_2", ok: true },
      ],
    });
  });

  it("deleteTopics handler throw → posts per-key error results", async () => {
    const provider = new SidebarProvider(vscodeMock.Uri.file("/ext"));
    const view = makeView();
    provider.resolveWebviewView(
      view as unknown as Parameters<typeof provider.resolveWebviewView>[0],
    );
    provider.setTopicHandlers({
      mergeTopic: () => Promise.resolve(),
      updateTopicLabel: () => Promise.resolve(),
      addTopic: () => Promise.resolve({ ok: true, key: "t_1" }),
      deleteTopics: () => Promise.reject(new Error("boom")),
    });
    await view.__trigger({ type: "deleteTopics", keys: ["t_1"] });
    expect(view.__posted).toContainEqual({
      type: "deleteTopicsResult",
      results: [{ key: "t_1", ok: false, error: "delete_failed" }],
    });
  });
});
