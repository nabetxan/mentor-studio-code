import { describe, expect, it } from "vitest";
import { parseConfig, parseLearnerProfile } from "../src/services/dataParser";
import { generateTopicKey } from "../src/services/fileWatcher";

describe("generateTopicKey", () => {
  it("converts label to lowercase hyphenated key with c- prefix", () => {
    expect(generateTopicKey("React Hooks")).toBe("c-react-hooks");
  });

  it("replaces non-alphanumeric characters with hyphens", () => {
    expect(generateTopicKey("Node.js & Express")).toBe("c-node-js-express");
  });

  it("collapses consecutive hyphens", () => {
    expect(generateTopicKey("  A  B  ")).toBe("c-a-b");
  });

  it("returns empty string for non-ASCII-only input", () => {
    expect(generateTopicKey("フック")).toBe("");
  });

  it("handles mixed ASCII and non-ASCII", () => {
    expect(generateTopicKey("React フック")).toBe("c-react");
  });
});

describe("parseLearnerProfile", () => {
  it("returns valid LearnerProfile from complete object", () => {
    const input = {
      experience: "3 years",
      level: "intermediate",
      interests: ["AI"],
      weak_areas: ["backend"],
      mentor_style: "gentle",
      last_updated: "2026-03-28T00:00:00Z",
    };
    expect(parseLearnerProfile(input)).toEqual(input);
  });

  it("returns null for non-object input", () => {
    expect(parseLearnerProfile(null)).toBeNull();
    expect(parseLearnerProfile("string")).toBeNull();
    expect(parseLearnerProfile(42)).toBeNull();
    expect(parseLearnerProfile(undefined)).toBeNull();
  });

  it("returns null when last_updated is missing", () => {
    expect(
      parseLearnerProfile({
        experience: "3 years",
        level: "intermediate",
        interests: [],
        weak_areas: [],
        mentor_style: "gentle",
      }),
    ).toBeNull();
  });

  it("defaults missing string fields to empty and missing arrays to []", () => {
    const result = parseLearnerProfile({
      last_updated: "2026-04-01T00:00:00Z",
    });
    expect(result).toEqual({
      experience: "",
      level: "",
      interests: [],
      weak_areas: [],
      mentor_style: "",
      last_updated: "2026-04-01T00:00:00Z",
    });
  });

  it("returns valid profile when last_updated is null", () => {
    const result = parseLearnerProfile({ last_updated: null });
    expect(result).not.toBeNull();
    expect(result!.last_updated).toBeNull();
  });
});

describe("parseConfig with new fields", () => {
  it("parses workspacePath when present", () => {
    const raw = JSON.stringify({
      repositoryName: "test",
      workspacePath: "/Users/test/workspace/my-project",
    });
    const result = parseConfig(raw);
    expect(result?.workspacePath).toBe("/Users/test/workspace/my-project");
  });

  it("parses without workspacePath (backwards compatible)", () => {
    const raw = JSON.stringify({
      repositoryName: "test",
    });
    const result = parseConfig(raw);
    expect(result).not.toBeNull();
    expect(result?.workspacePath).toBeUndefined();
  });

  it("parses extensionUninstalled when present", () => {
    const raw = JSON.stringify({
      repositoryName: "test",
      extensionUninstalled: true,
    });
    const result = parseConfig(raw);
    expect(result?.extensionUninstalled).toBe(true);
  });
});
