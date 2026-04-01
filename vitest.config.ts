import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "extension/vitest.config.ts",
      "extension/webview/vitest.config.ts",
    ],
  },
});
