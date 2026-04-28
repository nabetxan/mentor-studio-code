import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getExternalDataDirFor,
  getExternalDbPathFor,
  getExternalDataDirForWorkspaceFor,
  InvalidWorkspaceIdError,
} from "../../src/utils/dataPath";

describe("getExternalDataDirFor", () => {
  it("returns macOS Application Support path on darwin", () => {
    expect(getExternalDataDirFor("darwin", {}, "/fake/home")).toBe(
      "/fake/home/Library/Application Support/MentorStudioCode",
    );
  });

  it("returns APPDATA path on win32", () => {
    expect(
      getExternalDataDirFor(
        "win32",
        { APPDATA: "C:\\Users\\Test\\AppData\\Roaming" },
        "/fake/home",
      ),
    ).toBe(join("C:\\Users\\Test\\AppData\\Roaming", "MentorStudioCode"));
  });

  it("falls back to ~/AppData/Roaming on win32 when APPDATA unset", () => {
    expect(getExternalDataDirFor("win32", {}, "/fake/home")).toBe(
      join("/fake/home", "AppData", "Roaming", "MentorStudioCode"),
    );
  });

  it("returns XDG_DATA_HOME path on linux", () => {
    expect(
      getExternalDataDirFor("linux", { XDG_DATA_HOME: "/custom/xdg" }, "/fake/home"),
    ).toBe("/custom/xdg/mentor-studio-code");
  });

  it("falls back to ~/.local/share on linux when XDG_DATA_HOME unset", () => {
    expect(getExternalDataDirFor("linux", {}, "/fake/home")).toBe(
      "/fake/home/.local/share/mentor-studio-code",
    );
  });

  it("ignores empty-string env vars (treats as unset)", () => {
    expect(getExternalDataDirFor("win32", { APPDATA: "" }, "/fake/home")).toBe(
      join("/fake/home", "AppData", "Roaming", "MentorStudioCode"),
    );
    expect(getExternalDataDirFor("linux", { XDG_DATA_HOME: "" }, "/fake/home")).toBe(
      "/fake/home/.local/share/mentor-studio-code",
    );
  });
});

describe("getExternalDbPathFor / getExternalDataDirForWorkspaceFor", () => {
  it("getExternalDbPathFor joins <workspaceId>/data.db onto the dir", () => {
    expect(getExternalDbPathFor("darwin", {}, "/fake/home", "abc-123")).toBe(
      "/fake/home/Library/Application Support/MentorStudioCode/abc-123/data.db",
    );
  });

  it("getExternalDataDirForWorkspaceFor returns parent dir (no trailing data.db)", () => {
    expect(getExternalDataDirForWorkspaceFor("darwin", {}, "/fake/home", "abc-123")).toBe(
      "/fake/home/Library/Application Support/MentorStudioCode/abc-123",
    );
  });

  it("rejects invalid workspaceId values", () => {
    expect(() =>
      getExternalDbPathFor("darwin", {}, "/fake/home", "../../evil"),
    ).toThrow(InvalidWorkspaceIdError);
    expect(() =>
      getExternalDataDirForWorkspaceFor("darwin", {}, "/fake/home", "../../evil"),
    ).toThrow(InvalidWorkspaceIdError);
  });
});
