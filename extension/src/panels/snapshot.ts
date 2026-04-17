import type {
  PlanDto,
  PlanStatus,
  TaskDto,
  TaskStatus,
  TopicDto,
} from "@mentor-studio/shared";
import { readFileSync } from "node:fs";
import { loadSqlJs } from "../db";
import { topicIdToKey } from "../services/dbDashboard";

export async function readSnapshot(
  dbPath: string,
  wasmPath: string,
): Promise<{ plans: PlanDto[]; tasks: TaskDto[]; topics: TopicDto[] }> {
  const SQL = await loadSqlJs(wasmPath);
  const db = new SQL.Database(readFileSync(dbPath));
  try {
    // Plans
    const plansRes = db.exec(
      "SELECT id, name, filePath, status, sortOrder FROM plans ORDER BY sortOrder ASC",
    );
    const plans: PlanDto[] = (plansRes[0]?.values ?? []).map((r) => ({
      id: Number(r[0]),
      name: String(r[1] ?? ""),
      filePath: r[2] === null || r[2] === undefined ? null : String(r[2]),
      status: String(r[3]) as PlanStatus,
      sortOrder: Number(r[4]),
    }));

    // Tasks
    const tasksRes = db.exec(
      "SELECT id, planId, name, status, sortOrder FROM tasks ORDER BY planId ASC, sortOrder ASC",
    );
    const tasks: TaskDto[] = (tasksRes[0]?.values ?? []).map((r) => ({
      id: Number(r[0]),
      planId: Number(r[1]),
      name: String(r[2] ?? ""),
      status: String(r[3]) as TaskStatus,
      sortOrder: Number(r[4]),
    }));

    // Topics — schema has no sortOrder column; order by id
    const topicsRes = db.exec("SELECT id, label FROM topics ORDER BY id ASC");
    const topics: TopicDto[] = (topicsRes[0]?.values ?? []).map((r) => ({
      key: topicIdToKey(Number(r[0])),
      label: String(r[1] ?? ""),
    }));

    return { plans, tasks, topics };
  } finally {
    db.close();
  }
}
