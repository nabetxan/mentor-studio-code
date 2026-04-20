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

export interface DbProfileInput {
  experience: string;
  level: string;
  interests: string[];
  weakAreas: string[];
  mentorStyle: string;
  lastUpdated: string | null;
}

export function mapLearner(profile: DbProfileInput, flow: Flow): Learner {
  const out: Learner = {
    experience: profile.experience,
    level: profile.level,
    interests: profile.interests,
    weakAreas: profile.weakAreas,
    mentorStyle: profile.mentorStyle,
  };
  if (flow === "mentor-session") {
    out.lastUpdated = profile.lastUpdated;
  }
  return out;
}
