// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlanGroup } from "../../../src/panels/webview/PlanGroup";

afterEach(cleanup);

describe("PlanGroup", () => {
  it("renders header with status label and count", () => {
    render(
      <PlanGroup status="queued" count={3} reorderable={false} defaultOpen>
        <div>child</div>
      </PlanGroup>,
    );
    expect(screen.getByText(/Queued/)).toBeTruthy();
    expect(screen.getByText(/3/)).toBeTruthy();
  });

  it("renders children when open", () => {
    render(
      <PlanGroup status="queued" count={1} reorderable={false} defaultOpen>
        <div>visible-child</div>
      </PlanGroup>,
    );
    expect(screen.getByText("visible-child")).toBeTruthy();
  });

  it("hides children when collapsed via click", () => {
    render(
      <PlanGroup status="queued" count={1} reorderable={false} defaultOpen>
        <div>visible-child</div>
      </PlanGroup>,
    );
    fireEvent.click(screen.getByRole("button", { name: /queued/i }));
    expect(screen.queryByText("visible-child")).toBeNull();
  });

  it("defaultOpen=false starts collapsed", () => {
    render(
      <PlanGroup
        status="completed"
        count={2}
        reorderable={false}
        defaultOpen={false}
      >
        <div>hidden-child</div>
      </PlanGroup>,
    );
    expect(screen.queryByText("hidden-child")).toBeNull();
  });

  it("empty group is disabled (aria-disabled) and not clickable", () => {
    render(
      <PlanGroup status="active" count={0} reorderable={false} defaultOpen>
        <div>should-not-appear</div>
      </PlanGroup>,
    );
    const header = screen.getByRole("button", { name: /active/i });
    expect(header.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(header);
    expect(screen.queryByText("should-not-appear")).toBeNull();
  });
});
