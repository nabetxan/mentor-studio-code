import type {
  PlanDto,
  PlanStatus,
  TaskDto,
  TaskStatus,
  TopicDto,
} from "@mentor-studio/shared";

// Extension → Panel
export type PanelMessage =
  | { type: "initData"; plans: PlanDto[]; tasks: TaskDto[]; topics: TopicDto[] }
  | { type: "dbChanged"; timestamp?: number } // optional — not all broadcasters populate it
  | { type: "writeError"; requestId: string; error: string }
  | { type: "writeOk"; requestId: string };

// Panel → Extension
export type PanelRequest =
  | { type: "reorderPlans"; requestId: string; orderedIds: number[] }
  | {
      type: "reorderTasks";
      requestId: string;
      planId: number;
      orderedIds: number[];
    }
  | {
      type: "createPlan";
      requestId: string;
      name: string;
      filePath: string | null;
    }
  | {
      type: "updatePlan";
      requestId: string;
      id: number;
      name?: string;
      filePath?: string | null;
      status?: PlanStatus;
    }
  | { type: "deletePlan"; requestId: string; id: number }
  | { type: "createTask"; requestId: string; planId: number; name: string }
  | {
      type: "updateTask";
      requestId: string;
      id: number;
      name?: string;
      status?: TaskStatus;
    }
  | { type: "deleteTask"; requestId: string; id: number }
  | { type: "openMarkdownFile"; filePath: string }
  | { type: "ready" };
