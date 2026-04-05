import { describe, expect, it } from "vitest";
import { removeMentorRefFromContent } from "../src/services/claudeMd";

const REF = "@.mentor/rules/MENTOR_RULES.md";

describe("removeMentorRefFromContent", () => {
  it("removes the exact line containing the mentor ref", () => {
    const content = `## Git\n\nNEVER COMMIT.\n\n${REF}\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("## Git\n\nNEVER COMMIT.\n");
  });

  it("removes ref with leading/trailing whitespace on the line", () => {
    const content = `line1\n  ${REF}  \nline3\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("line1\nline3\n");
  });

  it("collapses triple blank lines to double after removal", () => {
    const content = `line1\n\n${REF}\n\nline3\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("line1\n\nline3\n");
  });

  it("returns content unchanged if ref not present", () => {
    const content = "## Git\n\nSome content\n";
    const result = removeMentorRefFromContent(content);
    expect(result).toBe(content);
  });

  it("handles file with only the ref line", () => {
    const content = `${REF}\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("");
  });

  it("handles multiple occurrences (removes all)", () => {
    const content = `${REF}\nsome text\n${REF}\n`;
    const result = removeMentorRefFromContent(content);
    expect(result).toBe("some text\n");
  });
});
