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
      } catch (err) {
        // Subscriber may have disposed; keep delivering to others,
        // but surface the failure so silent breakage is debuggable.
        console.error("BroadcastBus: subscriber threw during postMessage", err);
      }
    }
  }
}
