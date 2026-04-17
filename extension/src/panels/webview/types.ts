import type { PlanDto } from "@mentor-studio/shared";

/** Local UI shape — we overlay a `pending` flag on server DTOs. */
export interface UiPlan extends PlanDto {
  pending?: boolean;
}
