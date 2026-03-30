import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      vscode: resolve(__dirname, "test/__mocks__/vscode.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
