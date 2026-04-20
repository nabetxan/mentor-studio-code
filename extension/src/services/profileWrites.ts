import type { LearnerProfile } from "@mentor-studio/shared";
import { withWriteTransaction } from "../db";

export async function insertLearnerProfileRow(
  dbPath: string,
  wasmPath: string,
  profile: LearnerProfile,
): Promise<void> {
  await withWriteTransaction(
    dbPath,
    { wasmPath, purpose: "normal" },
    (db) => {
      const stmt = db.prepare(
        `INSERT INTO learner_profile
           (experience, level, interests, weakAreas, mentorStyle, lastUpdated)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      try {
        stmt.run([
          profile.experience,
          profile.level,
          JSON.stringify(profile.interests),
          JSON.stringify(profile.weak_areas),
          profile.mentor_style,
          profile.last_updated ?? new Date().toISOString(),
        ]);
      } finally {
        stmt.free();
      }
    },
  );
}
