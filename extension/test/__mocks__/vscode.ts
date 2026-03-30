export class Disposable {
  dispose(): void {}
}

export class RelativePattern {
  constructor(
    public base: string,
    public pattern: string,
  ) {}
}

export const workspace = {
  createFileSystemWatcher: () => ({
    onDidChange: () => new Disposable(),
    onDidCreate: () => new Disposable(),
    onDidDelete: () => new Disposable(),
    dispose: () => {},
  }),
};
