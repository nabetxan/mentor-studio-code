import { readFileSync } from "node:fs";
import { join } from "node:path";

import { setEmbeddedWasm } from "../src/db/sqlJsLoader";

// In production the CLI bundle inlines sql-wasm.wasm via esbuild's binary loader.
// Vitest imports source files directly (no bundler), so register the bytes here
// so tests that hit CLI commands exercise the same "embedded wasm" code path.
setEmbeddedWasm(readFileSync(join(__dirname, "..", "dist", "sql-wasm.wasm")));
