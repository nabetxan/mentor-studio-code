export interface Subscriber {
  postMessage(msg: unknown): void;
}

export class BroadcastBus {
  private subs = new Set<Subscriber>();

  register(sub: Subscriber): () => void {
    this.subs.add(sub);
    return () => {
      this.subs.delete(sub);
    };
  }

  broadcast(msg: unknown): void {
    for (const s of this.subs) {
      try {
        s.postMessage(msg);
      } catch {
        // drop — subscriber may have disposed
      }
    }
  }
}
