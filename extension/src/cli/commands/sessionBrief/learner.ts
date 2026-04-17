export type Flow =
  | "mentor-session"
  | "review"
  | "comprehension-check"
  | "implementation-review";

export interface Learner {
  experience: string;
  level: string;
  interests: string[];
  weakAreas: string[];
  mentorStyle: string;
  lastUpdated?: string | null;
}

function asString(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

function asStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : [];
}

export function mapLearner(
  profile: Record<string, unknown>,
  flow: Flow,
): Learner {
  const out: Learner = {
    experience: asString(profile.experience),
    level: asString(profile.level),
    interests: asStringArray(profile.interests),
    weakAreas: asStringArray(profile.weak_areas),
    mentorStyle: asString(profile.mentor_style),
  };
  if (flow === "mentor-session") {
    const lu = profile.last_updated;
    out.lastUpdated = typeof lu === "string" ? lu : null;
  }
  return out;
}
