export interface ProgressRewriteInput {
  progress: Record<string, unknown>;
}

export function rewriteProgress(
  input: ProgressRewriteInput,
): Record<string, unknown> {
  const p = input.progress;
  return {
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
