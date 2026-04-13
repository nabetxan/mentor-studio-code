import { existsSync, readFileSync } from "node:fs";

import { atomicWriteFile } from "../../db";

const EMPTY_PROGRESS = {
  current_task: null as number | null,
  current_step: null as string | null,
  resume_context: null as string | null,
  learner_profile: {} as Record<string, unknown>,
};

export async function syncCurrentTask(
  progressPath: string,
  newCurrentTask: number | null,
): Promise<void> {
  const base: Record<string, unknown> = existsSync(progressPath)
    ? (JSON.parse(readFileSync(progressPath, "utf-8")) as Record<
        string,
        unknown
      >)
    : { ...EMPTY_PROGRESS };
  base.current_task = newCurrentTask;
  const body = JSON.stringify(base, null, 2) + "\n";
  await atomicWriteFile(progressPath, Buffer.from(body, "utf-8"));
}
