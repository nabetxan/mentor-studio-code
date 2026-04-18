// esbuild entry point for .mentor/tools/mentor-cli.cjs.
// Registers the inlined sql-wasm bytes before any handler runs, then invokes main().
// Kept separate from main.ts so tests (which import dispatch) don't pull in the wasm.

import embeddedWasm from "sql.js/dist/sql-wasm.wasm";
import { setEmbeddedWasm } from "../db/sqlJsLoader";
import { main } from "./main";

setEmbeddedWasm(embeddedWasm);

main(process.argv).catch((err: unknown) => {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: "unexpected",
      detail: err instanceof Error ? err.message : String(err),
    }) + "\n",
  );
  process.exitCode = 1;
});
