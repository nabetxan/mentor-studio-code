import { describe, expect, it } from "vitest";
import type { PanelMessage, PanelRequest } from "../../src/panels/protocol";

// Type-level tests: confirm union narrowing works correctly.
// These are compile-time checks; at runtime they just assert structural assignments.

describe("protocol types", () => {
  it("PanelMessage discriminates on type", () => {
    const msg: PanelMessage = {
      type: "initData",
      plans: [],
      tasks: [],
      topics: [],
    };
    if (msg.type === "initData") {
      expect(Array.isArray(msg.plans)).toBe(true);
      expect(Array.isArray(msg.tasks)).toBe(true);
      expect(Array.isArray(msg.topics)).toBe(true);
    }
  });

  it("PanelMessage dbChanged carries timestamp", () => {
    const msg: PanelMessage = { type: "dbChanged", timestamp: 12345 };
    if (msg.type === "dbChanged") {
      expect(typeof msg.timestamp).toBe("number");
    }
  });

  it("PanelMessage writeOk carries requestId", () => {
    const msg: PanelMessage = { type: "writeOk", requestId: "r1" };
    if (msg.type === "writeOk") {
      expect(msg.requestId).toBe("r1");
    }
  });

  it("PanelMessage writeError carries requestId and error", () => {
    const msg: PanelMessage = {
      type: "writeError",
      requestId: "r2",
      error: "oops",
    };
    if (msg.type === "writeError") {
      expect(msg.requestId).toBe("r2");
      expect(msg.error).toBe("oops");
    }
  });

  it("PanelRequest ready has no extra fields", () => {
    const req: PanelRequest = { type: "ready" };
    expect(req.type).toBe("ready");
  });

  it("PanelRequest openMarkdownFile carries filePath", () => {
    const req: PanelRequest = {
      type: "openMarkdownFile",
      filePath: "/some/path.md",
    };
    if (req.type === "openMarkdownFile") {
      expect(req.filePath).toBe("/some/path.md");
    }
  });

  it("PanelRequest createPlan carries name and filePath", () => {
    const req: PanelRequest = {
      type: "createPlan",
      requestId: "r3",
      name: "My Plan",
      filePath: null,
    };
    if (req.type === "createPlan") {
      expect(req.name).toBe("My Plan");
      expect(req.filePath).toBeNull();
      expect(req.requestId).toBe("r3");
    }
  });

  it("PanelRequest updatePlan status field is optional", () => {
    const req: PanelRequest = { type: "updatePlan", requestId: "r4", id: 1 };
    if (req.type === "updatePlan") {
      expect(req.id).toBe(1);
      expect(req.status).toBeUndefined();
    }
  });

  it("PanelRequest reorderPlans carries orderedIds array", () => {
    const req: PanelRequest = {
      type: "reorderPlans",
      requestId: "r5",
      orderedIds: [3, 1, 2],
    };
    if (req.type === "reorderPlans") {
      expect(req.orderedIds).toEqual([3, 1, 2]);
    }
  });

  it("PanelRequest reorderTasks carries planId and orderedIds", () => {
    const req: PanelRequest = {
      type: "reorderTasks",
      requestId: "r6",
      planId: 7,
      orderedIds: [2, 1],
    };
    if (req.type === "reorderTasks") {
      expect(req.planId).toBe(7);
      expect(req.orderedIds).toEqual([2, 1]);
    }
  });
});
