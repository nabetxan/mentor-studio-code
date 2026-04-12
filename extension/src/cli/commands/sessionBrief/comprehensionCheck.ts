import type { Database } from "sql.js";

export interface ComprehensionCheckOutput {
  coveredConcepts: { topicId: number; concept: string; count: number }[];
  coveredConceptsTotal?: number;
  topicSummary: { topicId: number; count: number }[];
  allTopics: { id: number; label: string }[];
}

export function comprehensionCheckBrief(
  db: Database,
): ComprehensionCheckOutput {
  const distinctRes = db.exec(
    "SELECT COUNT(*) FROM (SELECT DISTINCT topicId, concept FROM questions)",
  );
  const distinctTotal = Number(distinctRes[0]?.values[0][0] ?? 0);

  const conceptsRes = db.exec(
    "SELECT topicId, concept, COUNT(*) AS c FROM questions GROUP BY topicId, concept ORDER BY c DESC, concept ASC LIMIT 100",
  );
  const coveredConcepts = conceptsRes[0]
    ? conceptsRes[0].values.map((row) => ({
        topicId: Number(row[0]),
        concept: String(row[1]),
        count: Number(row[2]),
      }))
    : [];

  const summaryRes = db.exec(
    "SELECT topicId, COUNT(*) FROM questions GROUP BY topicId ORDER BY topicId ASC",
  );
  const topicSummary = summaryRes[0]
    ? summaryRes[0].values.map((row) => ({
        topicId: Number(row[0]),
        count: Number(row[1]),
      }))
    : [];

  const topicsRes = db.exec("SELECT id, label FROM topics ORDER BY id ASC");
  const allTopics = topicsRes[0]
    ? topicsRes[0].values.map((row) => ({
        id: Number(row[0]),
        label: String(row[1]),
      }))
    : [];

  const out: ComprehensionCheckOutput = {
    coveredConcepts,
    topicSummary,
    allTopics,
  };
  if (distinctTotal > 100) out.coveredConceptsTotal = distinctTotal;
  return out;
}
