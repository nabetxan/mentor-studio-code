export interface ProgressRewriteInput {
  progress: Record<string, unknown>;
  taskMap: Map<string, number>;
}

export function rewriteProgress(
  input: ProgressRewriteInput,
): Record<string, unknown> {
  const p = input.progress;
  const rawCurrent = p.current_task;
  let current: number | null;
  if (typeof rawCurrent === "string") {
    current = input.taskMap.get(rawCurrent) ?? null;
  } else if (typeof rawCurrent === "number") {
    current = rawCurrent;
  } else {
    current = null;
  }
  return {
    current_task: current,
    current_step: p.current_step ?? null,
    resume_context: p.resume_context ?? null,
    learner_profile: p.learner_profile ?? {},
  };
}

export function rewriteConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...config };
  delete rest.topics;
  if (rest.mentorFiles && typeof rest.mentorFiles === "object") {
    const mf = { ...(rest.mentorFiles as Record<string, unknown>) };
    delete mf.plan;
    rest.mentorFiles = mf;
  }
  return rest;
}
