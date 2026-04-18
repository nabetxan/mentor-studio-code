import { build, context } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

function cliNoticesBanner() {
  const file = resolve(__dirname, "THIRD_PARTY_NOTICES.md");
  const raw = readFileSync(file, "utf8");
  const match = raw.match(
    /<!-- cli-notices-start -->([\s\S]*?)<!-- cli-notices-end -->/,
  );
  if (!match) {
    throw new Error(`CLI notices markers not found in ${file}`);
  }
  const body = match[1]
    .trim()
    .split("\n")
    .map((line) => (line.length === 0 ? " *" : ` * ${line}`))
    .join("\n");
  return [
    "#!/usr/bin/env node",
    "/*!",
    " * mentor-cli — part of Mentor Studio Code",
    " *",
    " * Third-party notices for code bundled into this file:",
    " *",
    body,
    " */",
  ].join("\n");
}

function copyWasm() {
  const entry = require.resolve("sql.js");
  const src = resolve(dirname(entry), "sql-wasm.wasm");
  const dest = resolve(__dirname, "dist/sql-wasm.wasm");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

const wasmCopyPlugin = {
  name: "copy-sql-wasm",
  setup(buildApi) {
    buildApi.onEnd(() => copyWasm());
  },
};

/** @type {import('esbuild').BuildOptions} */
const extensionOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: !isWatch,
  plugins: [wasmCopyPlugin],
};

/** @type {import('esbuild').BuildOptions} */
const cliOptions = {
  entryPoints: ["src/cli/entry.ts"],
  bundle: true,
  outfile: "dist/mentor-cli.cjs",
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: false,
  minify: !isWatch,
  banner: { js: cliNoticesBanner() },
  loader: { ".wasm": "binary" },
};

/** @type {import('esbuild').BuildOptions} */
const panelOptions = {
  entryPoints: ["src/panels/webview/main.tsx"],
  bundle: true,
  outfile: "dist/plan-panel.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  loader: { ".tsx": "tsx", ".ts": "ts" },
  sourcemap: isWatch ? "inline" : false,
  minify: !isWatch,
  jsx: "automatic",
};

if (isWatch) {
  const [extCtx, cliCtx, panelCtx] = await Promise.all([
    context(extensionOptions),
    context(cliOptions),
    context(panelOptions),
  ]);
  await Promise.all([extCtx.watch(), cliCtx.watch(), panelCtx.watch()]);
  console.log("Watching for changes...");
} else {
  await Promise.all([
    build(extensionOptions),
    build(cliOptions),
    build(panelOptions),
  ]);
  console.log("Build complete");
}
