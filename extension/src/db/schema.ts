/**
 * SCHEMA_VERSION = the target user_version for the SQLite schema.
 * `shouldMigrateV2` returns true while the on-disk schema is *less than* this.
 *
 * DO NOT bump this for releases that only relocate files (e.g. v3 external
 * storage). v3 is schema-less by design — detection happens via file
 * existence in `migration/v3ExternalDb.ts`. Bumping SCHEMA_VERSION re-fires
 * the v2 profile/app_state migration on every activation, which can corrupt
 * already-migrated profile data.
 *
 * Bump this ONLY when adding actual schema changes (new tables, columns,
 * constraints) — and add a corresponding migration step following the
 * `migrate.ts` / `v2ProfileAppState.ts` pattern.
 */
export const SCHEMA_VERSION = 2;

export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  filePath TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','queued','completed','paused','backlog','removed')),
  sortOrder INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  planId INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','queued','completed','skipped')),
  sortOrder INTEGER NOT NULL,
  FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lastAnsweredAt TEXT NOT NULL,
  taskId INTEGER,
  topicId INTEGER NOT NULL,
  concept TEXT NOT NULL,
  question TEXT NOT NULL,
  userAnswer TEXT NOT NULL,
  isCorrect INTEGER NOT NULL CHECK (isCorrect IN (0,1)),
  note TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE RESTRICT,
  FOREIGN KEY (topicId) REFERENCES topics(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS learner_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experience TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '[]',
  weakAreas TEXT NOT NULL DEFAULT '[]',
  mentorStyle TEXT NOT NULL DEFAULT '',
  lastUpdated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_questions_isCorrect ON questions(isCorrect);
CREATE INDEX IF NOT EXISTS idx_questions_topicId ON questions(topicId);
CREATE INDEX IF NOT EXISTS idx_questions_taskId ON questions(taskId) WHERE taskId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_plan_sort ON tasks(planId, sortOrder);
CREATE INDEX IF NOT EXISTS idx_plans_sort ON plans(sortOrder);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_plans_active ON plans(status) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_active ON tasks(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_learner_profile_lastUpdated ON learner_profile(lastUpdated DESC);
`;
