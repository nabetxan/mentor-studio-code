export class Disposable {
  dispose(): void {}
}

export class RelativePattern {
  constructor(
    public base: string,
    public pattern: string,
  ) {}
}

type Handler = (uri: unknown) => void;

export interface MockFileSystemWatcher {
  pattern: RelativePattern;
  onDidChange: (h: Handler) => Disposable;
  onDidCreate: (h: Handler) => Disposable;
  onDidDelete: (h: Handler) => Disposable;
  dispose: () => void;
  emitChange: () => void;
  emitCreate: () => void;
  emitDelete: () => void;
}

export const __watchers: MockFileSystemWatcher[] = [];

export function __resetWatchers(): void {
  __watchers.length = 0;
}

export const window = {
  showWarningMessage: (..._args: unknown[]): Promise<string | undefined> =>
    Promise.resolve(undefined),
  showErrorMessage: (..._args: unknown[]): Promise<string | undefined> =>
    Promise.resolve(undefined),
  showInformationMessage: (..._args: unknown[]): Promise<string | undefined> =>
    Promise.resolve(undefined),
  showQuickPick: (..._args: unknown[]): Promise<unknown> =>
    Promise.resolve(undefined),
  showOpenDialog: (..._args: unknown[]): Promise<unknown> =>
    Promise.resolve(undefined),
  showSaveDialog: (..._args: unknown[]): Promise<unknown> =>
    Promise.resolve(undefined),
  showTextDocument: (..._args: unknown[]): Promise<unknown> =>
    Promise.resolve(undefined),
};

export interface MockUri {
  fsPath: string;
  toString(): string;
}

export const Uri = {
  joinPath: (base: MockUri, ...parts: string[]): MockUri => {
    const fsPath = [base.fsPath, ...parts].join("/");
    return { fsPath, toString: () => fsPath };
  },
  file: (p: string): MockUri => ({ fsPath: p, toString: () => p }),
};

export const env = {
  language: "ja",
  clipboard: {
    writeText: (_text: string): Promise<void> => Promise.resolve(),
  },
};

export const commands = {
  executeCommand: (..._args: unknown[]): Promise<unknown> =>
    Promise.resolve(undefined),
};

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

interface MutableWorkspace {
  createFileSystemWatcher: (pattern: RelativePattern) => MockFileSystemWatcher;
  workspaceFolders: { uri: MockUri }[] | undefined;
  asRelativePath: (uri: MockUri, includeWorkspaceFolder: boolean) => string;
  getWorkspaceFolder: (uri: MockUri) => { uri: MockUri } | undefined;
  fs: {
    readFile: (uri: MockUri) => Promise<Uint8Array>;
    writeFile: (uri: MockUri, content: Uint8Array) => Promise<void>;
    createDirectory?: (uri: MockUri) => Promise<void>;
  };
}

export const workspace: MutableWorkspace = {
  createFileSystemWatcher: (
    pattern: RelativePattern,
  ): MockFileSystemWatcher => {
    const changeHandlers: Handler[] = [];
    const createHandlers: Handler[] = [];
    const deleteHandlers: Handler[] = [];
    const w: MockFileSystemWatcher = {
      pattern,
      onDidChange: (h) => {
        changeHandlers.push(h);
        return new Disposable();
      },
      onDidCreate: (h) => {
        createHandlers.push(h);
        return new Disposable();
      },
      onDidDelete: (h) => {
        deleteHandlers.push(h);
        return new Disposable();
      },
      dispose: () => {},
      emitChange: () => {
        for (const h of changeHandlers) h(undefined);
      },
      emitCreate: () => {
        for (const h of createHandlers) h(undefined);
      },
      emitDelete: () => {
        for (const h of deleteHandlers) h(undefined);
      },
    };
    __watchers.push(w);
    return w;
  },
  workspaceFolders: undefined,
  asRelativePath: (_uri: MockUri, _includeWorkspaceFolder: boolean): string =>
    "",
  getWorkspaceFolder: (_uri: MockUri): { uri: MockUri } | undefined =>
    undefined,
  fs: {
    readFile: (_uri: MockUri): Promise<Uint8Array> =>
      Promise.resolve(new Uint8Array()),
    writeFile: (_uri: MockUri, _content: Uint8Array): Promise<void> =>
      Promise.resolve(),
    createDirectory: (_uri: MockUri): Promise<void> => Promise.resolve(),
  },
};

workspace.getWorkspaceFolder = (
  uri: MockUri,
): { uri: MockUri } | undefined => {
  const folders = workspace.workspaceFolders ?? [];
  for (const f of folders) {
    const base = f.uri.fsPath.replace(/\/+$/, "");
    if (uri.fsPath === base || uri.fsPath.startsWith(base + "/")) {
      return f;
    }
  }
  return undefined;
};
workspace.asRelativePath = (
  uri: MockUri,
  _includeWorkspaceFolder: boolean,
): string => {
  const folder = workspace.getWorkspaceFolder(uri);
  if (!folder) return uri.fsPath;
  const base = folder.uri.fsPath.replace(/\/+$/, "");
  if (uri.fsPath === base) return "";
  return uri.fsPath.startsWith(base + "/")
    ? uri.fsPath.slice(base.length + 1)
    : uri.fsPath;
};
