import { build, context } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootNodeModules = resolve(__dirname, "..", "..", "node_modules");

function copyCodiconAssets() {
  mkdirSync(resolve(__dirname, "dist"), { recursive: true });
  copyFileSync(
    resolve(rootNodeModules, "@vscode", "codicons", "dist", "codicon.css"),
    resolve(__dirname, "dist", "codicon.css"),
  );
  copyFileSync(
    resolve(rootNodeModules, "@vscode", "codicons", "dist", "codicon.ttf"),
    resolve(__dirname, "dist", "codicon.ttf"),
  );
}

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/index.tsx"],
  bundle: true,
  outdir: "dist",
  entryNames: "webview",
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  jsx: "automatic",
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(options);
  copyCodiconAssets();
  console.log("Webview build complete");
}
