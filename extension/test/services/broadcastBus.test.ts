import { afterEach, describe, expect, it, vi } from "vitest";
import { BroadcastBus } from "../../src/services/broadcastBus";

describe("BroadcastBus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("logs when a subscriber throws and still delivers to others", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bus = new BroadcastBus();
    const got: unknown[] = [];
    const boom = new Error("boom");
    bus.register({
      postMessage: () => {
        throw boom;
      },
    });
    bus.register({ postMessage: (m) => got.push(m) });
    bus.broadcast({ type: "ping" });
    expect(got).toEqual([{ type: "ping" }]);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0]?.[1]).toBe(boom);
  });
});
