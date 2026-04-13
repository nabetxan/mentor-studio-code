import type { Database } from "sql.js";

export interface LegacyTopic {
  key: string;
  label: string;
}

function lastInsertRowId(db: Database): number {
  const r = db.exec("SELECT last_insert_rowid()");
  return Number(r[0].values[0][0]);
}

export function insertTopics(
  db: Database,
  topics: LegacyTopic[],
): Map<string, number> {
  const map = new Map<string, number>();
  const stmt = db.prepare("INSERT INTO topics(label) VALUES (?)");
  try {
    for (const t of topics) {
      stmt.run([t.label]);
      map.set(t.key, lastInsertRowId(db));
    }
  } finally {
    stmt.free();
  }
  return map;
}

export function ensureTopicId(
  db: Database,
  map: Map<string, number>,
  oldKey: string,
): number {
  const existing = map.get(oldKey);
  if (existing !== undefined) return existing;
  const stmt = db.prepare("INSERT INTO topics(label) VALUES (?)");
  try {
    stmt.run([oldKey]);
  } finally {
    stmt.free();
  }
  const id = lastInsertRowId(db);
  map.set(oldKey, id);
  return id;
}
