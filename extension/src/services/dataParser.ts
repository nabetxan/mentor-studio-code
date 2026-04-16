import type { LearnerProfile, MentorStudioConfig } from "@mentor-studio/shared";

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
    const mentorFiles =
      typeof obj.mentorFiles === "object" && obj.mentorFiles !== null
        ? {
            spec:
              typeof (obj.mentorFiles as Record<string, unknown>).spec ===
              "string"
                ? ((obj.mentorFiles as Record<string, unknown>).spec as string)
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
