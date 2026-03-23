import type { ExtensionMessage, WebviewMessage } from "@mentor-studio/shared";

interface VSCodeApi {
  postMessage(message: WebviewMessage): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

const vscode: VSCodeApi =
  (globalThis as Record<string, unknown>).acquireVsCodeApi !== undefined
    ? (
        globalThis as unknown as { acquireVsCodeApi: () => VSCodeApi }
      ).acquireVsCodeApi()
    : { postMessage: () => {}, getState: () => undefined, setState: () => {} };

export function postMessage(message: WebviewMessage): void {
  vscode.postMessage(message);
}

export function onMessage(
  handler: (message: ExtensionMessage) => void,
): () => void {
  const listener = (event: MessageEvent<ExtensionMessage>) => {
    handler(event.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
