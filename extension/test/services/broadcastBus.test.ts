import { describe, expect, it } from "vitest";
import { BroadcastBus } from "../../src/services/broadcastBus";

describe("BroadcastBus", () => {
  it("broadcasts to registered subscribers", () => {
    const bus = new BroadcastBus();
    const a: unknown[] = [];
    const b: unknown[] = [];
    bus.register({ postMessage: (m) => a.push(m) });
    bus.register({ postMessage: (m) => b.push(m) });
    bus.broadcast({ type: "hi" });
    expect(a).toEqual([{ type: "hi" }]);
    expect(b).toEqual([{ type: "hi" }]);
  });

  it("unregister stops delivery", () => {
    const bus = new BroadcastBus();
    const got: unknown[] = [];
    const unsub = bus.register({ postMessage: (m) => got.push(m) });
    unsub();
    bus.broadcast(1);
    expect(got).toEqual([]);
  });
});
