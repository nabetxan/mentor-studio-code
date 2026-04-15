import type { PlanDto, TaskDto } from "@mentor-studio/shared";

/** Optimistic UI pending flags keyed by item id (negative ids = tentative). */
export interface PendingState {
  plans: Record<number, boolean>;
  tasks: Record<number, boolean>;
}

/** Local UI shape — we overlay a `pending` flag on server DTOs. */
export interface UiPlan extends PlanDto {
  pending?: boolean;
}

export interface UiTask extends TaskDto {
  pending?: boolean;
}
