import type { BindParams, Statement } from "sql.js";

export type SafeRunValue = number | string | Uint8Array | null;

export function safeRun(
  stmt: Statement,
  site: string,
  rowId: string,
  params: ReadonlyArray<SafeRunValue | undefined>,
): void {
  for (let i = 0; i < params.length; i++) {
    if (params[i] === undefined) {
      throw new Error(
        `[migration] undefined bind at ${site} param[${i}] for row=${rowId}; params=${JSON.stringify(
          params,
        )}`,
      );
    }
  }
  stmt.run(params as BindParams);
}
