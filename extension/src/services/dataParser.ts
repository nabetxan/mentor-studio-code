import type {
  LearnerProfile,
  MentorStudioConfig,
  ProgressData,
  SkippedTask,
  UnresolvedGap,
} from "@mentor-studio/shared";

/**
 * Validates an unknown value (e.g. from globalState or raw JSON) as a LearnerProfile.
 * Returns null if the value is not a valid object or has no last_updated field.
 */
export function parseLearnerProfile(value: unknown): LearnerProfile | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.last_updated !== "string" && obj.last_updated !== null) {
    return null;
  }
  return {
    experience: typeof obj.experience === "string" ? obj.experience : "",
    level: typeof obj.level === "string" ? obj.level : "",
    interests: Array.isArray(obj.interests)
      ? (obj.interests as unknown[]).filter(
          (i): i is string => typeof i === "string",
        )
      : [],
    weak_areas: Array.isArray(obj.weak_areas)
      ? (obj.weak_areas as unknown[]).filter(
          (i): i is string => typeof i === "string",
        )
      : [],
    mentor_style: typeof obj.mentor_style === "string" ? obj.mentor_style : "",
    last_updated:
      typeof obj.last_updated === "string" ? obj.last_updated : null,
  };
}

export function parseProgressData(raw: string): ProgressData | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) {
      return null;
    }
    const obj = data as Record<string, unknown>;
    if (
      typeof obj.version !== "string" ||
      (obj.current_task !== null && typeof obj.current_task !== "string") ||
      !Array.isArray(obj.completed_tasks)
    ) {
      return null;
    }
    const completedTasks = (obj.completed_tasks as unknown[]).filter(
      (item): item is { task: string; name: string; plan: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).task === "string" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        typeof (item as Record<string, unknown>).plan === "string",
    );
    const learnerProfile =
      typeof obj.learner_profile === "object" && obj.learner_profile !== null
        ? (parseLearnerProfile(obj.learner_profile) ?? undefined)
        : undefined;
    return {
      version: obj.version,
      current_plan:
        typeof obj.current_plan === "string" ? obj.current_plan : null,
      current_task:
        typeof obj.current_task === "string" ? obj.current_task : null,
      current_step:
        typeof obj.current_step === "string" ||
        typeof obj.current_step === "number"
          ? obj.current_step
          : null,
      next_suggest:
        typeof obj.next_suggest === "string" ? obj.next_suggest : null,
      resume_context:
        typeof obj.resume_context === "string" ? obj.resume_context : null,
      completed_tasks: completedTasks,
      learner_profile: learnerProfile,
      skipped_tasks: Array.isArray(obj.skipped_tasks)
        ? (obj.skipped_tasks as unknown[]).filter(
            (item): item is SkippedTask =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as Record<string, unknown>).task === "string" &&
              typeof (item as Record<string, unknown>).plan === "string",
          )
        : [],
      unresolved_gaps: Array.isArray(obj.unresolved_gaps)
        ? (obj.unresolved_gaps as unknown[]).filter(
            (item): item is UnresolvedGap =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as Record<string, unknown>).questionId ===
                "string" &&
              typeof (item as Record<string, unknown>).concept === "string" &&
              typeof (item as Record<string, unknown>).topic === "string" &&
              typeof (item as Record<string, unknown>).last_missed ===
                "string" &&
              typeof (item as Record<string, unknown>).task === "string" &&
              typeof (item as Record<string, unknown>).note === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

export function parseConfig(raw: string): MentorStudioConfig | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) {
      return null;
    }
    const obj = data as Record<string, unknown>;
    if (typeof obj.repositoryName !== "string") {
      return null;
    }
    const rawTopics = Array.isArray(obj.topics) ? obj.topics : [];
    const topics = rawTopics.filter(
      (item): item is { key: string; label: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).key === "string" &&
        typeof (item as Record<string, unknown>).label === "string",
    );
    const mentorFiles =
      typeof obj.mentorFiles === "object" && obj.mentorFiles !== null
        ? {
            spec:
              typeof (obj.mentorFiles as Record<string, unknown>).spec ===
              "string"
                ? ((obj.mentorFiles as Record<string, unknown>).spec as string)
                : null,
            plan:
              typeof (obj.mentorFiles as Record<string, unknown>).plan ===
              "string"
                ? ((obj.mentorFiles as Record<string, unknown>).plan as string)
                : null,
          }
        : undefined;
    const workspacePath =
      typeof obj.workspacePath === "string" ? obj.workspacePath : undefined;
    const extensionUninstalled =
      typeof obj.extensionUninstalled === "boolean"
        ? obj.extensionUninstalled
        : undefined;
    return {
      repositoryName: obj.repositoryName,
      workspacePath,
      topics,
      mentorFiles,
      locale:
        obj.locale === "ja" || obj.locale === "en" ? obj.locale : undefined,
      enableMentor:
        typeof obj.enableMentor === "boolean" ? obj.enableMentor : undefined,
      extensionVersion:
        typeof obj.extensionVersion === "string"
          ? obj.extensionVersion
          : undefined,
      extensionUninstalled,
    };
  } catch {
    return null;
  }
}
