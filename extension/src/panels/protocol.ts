import type {
  Locale,
  PlanDto,
  PlanStatus,
  TaskDto,
  TaskStatus,
  TopicDto,
} from "@mentor-studio/shared";

// Extension → Panel
export type PanelMessage =
  | {
      type: "initData";
      plans: PlanDto[];
      tasks: TaskDto[];
      topics: TopicDto[];
      locale: Locale;
    }
  | { type: "dbChanged"; timestamp?: number } // optional — not all broadcasters populate it
  | { type: "writeError"; requestId: string; error: string }
  | { type: "writeOk"; requestId: string }
  | { type: "pickPlanFileResult"; requestId: string; filePath: string | null };

// Panel → Extension
export type PanelRequest =
  | { type: "reorderPlans"; requestId: string; orderedIds: number[] }
  | {
      type: "reorderQueuedTasks";
      requestId: string;
      planId: number;
      queuedTaskIds: number[];
    }
  | { type: "createPlan"; requestId: string; name: string; filePath: string }
  | { type: "createTask"; requestId: string; planId: number; name: string }
  | {
      type: "updatePlan";
      requestId: string;
      id: number;
      name?: string;
      filePath?: string | null;
    }
  | { type: "updateTask"; requestId: string; id: number; name?: string }
  | { type: "removePlan"; requestId: string; id: number }
  | { type: "deleteTask"; requestId: string; id: number }
  | {
      type: "setPlanStatus";
      requestId: string;
      id: number;
      toStatus: PlanStatus;
    }
  | {
      type: "setTaskStatus";
      requestId: string;
      id: number;
      toStatus: TaskStatus;
    }
  | { type: "openMarkdownFile"; filePath: string }
  | { type: "pickPlanFile"; requestId: string }
  | { type: "ready" };
