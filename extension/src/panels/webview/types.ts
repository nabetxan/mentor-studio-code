import type { PlanDto, TaskDto } from "@mentor-studio/shared";

/** Local UI shape — we overlay a `pending` flag on server DTOs. */
export interface UiPlan extends PlanDto {
  pending?: boolean;
}

export interface UiTask extends TaskDto {
  pending?: boolean;
}
