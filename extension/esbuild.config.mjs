import { build, context } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

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
const options = {
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

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(options);
  console.log("Build complete");
}
