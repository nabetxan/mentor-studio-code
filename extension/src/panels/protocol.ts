import type {
  Locale,
  PlanDto,
  PlanStatus,
  TaskDto,
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
  | { type: "createPlan"; requestId: string; name: string; filePath: string }
  | {
      type: "updatePlan";
      requestId: string;
      id: number;
      name?: string;
      filePath?: string | null;
    }
  | { type: "removePlan"; requestId: string; id: number }
  | {
      type: "setPlanStatus";
      requestId: string;
      id: number;
      toStatus: PlanStatus;
    }
  | { type: "openMarkdownFile"; filePath: string }
  | { type: "pickPlanFile"; requestId: string }
  | { type: "ready" };
