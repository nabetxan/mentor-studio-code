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
      locale: "en",
    };
    if (msg.type === "initData") {
      expect(Array.isArray(msg.plans)).toBe(true);
      expect(Array.isArray(msg.tasks)).toBe(true);
      expect(Array.isArray(msg.topics)).toBe(true);
      expect(msg.locale).toBe("en");
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

  it("PanelMessage pickPlanFileResult carries requestId and filePath", () => {
    const msg: PanelMessage = {
      type: "pickPlanFileResult",
      requestId: "r-pick",
      filePath: "/path/to/plan.md",
    };
    if (msg.type === "pickPlanFileResult") {
      expect(msg.requestId).toBe("r-pick");
      expect(msg.filePath).toBe("/path/to/plan.md");
    }
  });

  it("PanelMessage pickPlanFileResult allows null filePath (cancelled)", () => {
    const msg: PanelMessage = {
      type: "pickPlanFileResult",
      requestId: "r-cancel",
      filePath: null,
    };
    if (msg.type === "pickPlanFileResult") {
      expect(msg.filePath).toBeNull();
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

  it("PanelRequest createPlan carries name and filePath (string required)", () => {
    const req: PanelRequest = {
      type: "createPlan",
      requestId: "r3",
      name: "My Plan",
      filePath: "/workspace/plan.md",
    };
    if (req.type === "createPlan") {
      expect(req.name).toBe("My Plan");
      expect(req.filePath).toBe("/workspace/plan.md");
      expect(req.requestId).toBe("r3");
    }
  });

  it("PanelRequest updatePlan carries optional name and filePath", () => {
    const req: PanelRequest = {
      type: "updatePlan",
      requestId: "r4",
      id: 1,
      name: "Renamed",
    };
    if (req.type === "updatePlan") {
      expect(req.id).toBe(1);
      expect(req.name).toBe("Renamed");
      expect(req.filePath).toBeUndefined();
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

  it("PanelRequest removePlan carries id", () => {
    const req: PanelRequest = {
      type: "removePlan",
      requestId: "r-rem",
      id: 10,
    };
    if (req.type === "removePlan") {
      expect(req.id).toBe(10);
    }
  });

  it("PanelRequest setPlanStatus carries id and toStatus", () => {
    const req: PanelRequest = {
      type: "setPlanStatus",
      requestId: "r-ss",
      id: 11,
      toStatus: "backlog",
    };
    if (req.type === "setPlanStatus") {
      expect(req.id).toBe(11);
      expect(req.toStatus).toBe("backlog");
    }
  });

  it("PanelRequest pickPlanFile carries requestId", () => {
    const req: PanelRequest = {
      type: "pickPlanFile",
      requestId: "r-pick",
    };
    if (req.type === "pickPlanFile") {
      expect(req.requestId).toBe("r-pick");
    }
  });
});
