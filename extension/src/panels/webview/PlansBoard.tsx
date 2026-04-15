import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { PlanStatus } from "@mentor-studio/shared";
import { useMemo, useState } from "react";
import { PlanRow } from "./PlanRow";
import { s } from "./styles";
import type { UiPlan } from "./types";

interface Props {
  plans: UiPlan[];
  onCreatePlanFromFile: () => void;
  onRenamePlan: (id: number, name: string) => void;
  onActivatePlan: (id: number) => void;
  onDeactivatePlan: (id: number) => void;
  onRemovePlan: (id: number) => void;
  onRestorePlan: (id: number) => void;
  onOpenFile: (filePath: string) => void;
  onReorder: (orderedIds: number[]) => void;
  error: string | null;
}

/** Exported pure reorder callback — testable without pointer events. */
export function computeReorderedIds(
  ids: number[],
  activeId: number,
  overId: number,
): number[] {
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return ids;
  return arrayMove(ids, oldIndex, newIndex);
}

const DEFAULT_STATUSES: ReadonlySet<PlanStatus> = new Set<PlanStatus>([
  "active",
  "queued",
  "paused",
  "backlog",
]);

export function PlansBoard(props: Props): JSX.Element {
  const {
    plans,
    onCreatePlanFromFile,
    onRenamePlan,
    onActivatePlan,
    onDeactivatePlan,
    onRemovePlan,
    onRestorePlan,
    onOpenFile,
    onReorder,
    error,
  } = props;

  const [showCompleted, setShowCompleted] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);

  const visiblePlans = useMemo(() => {
    return plans.filter((p) => {
      if (DEFAULT_STATUSES.has(p.status)) return true;
      if (p.status === "completed" && showCompleted) return true;
      if (p.status === "removed" && showRemoved) return true;
      return false;
    });
  }, [plans, showCompleted, showRemoved]);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(ev: DragEndEvent): void {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const ids = visiblePlans.map((p) => p.id);
    const reordered = computeReorderedIds(
      ids,
      Number(active.id),
      Number(over.id),
    );
    if (reordered !== ids) onReorder(reordered);
  }

  return (
    <div style={s.pane} data-testid="plans-board">
      <div style={s.header}>
        <span style={s.headerTitle}>Plans</span>
        <span style={s.headerToggles}>
          <label style={s.toggleLabel}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              aria-label="show completed"
            />
            Show Completed
          </label>
          <label style={s.toggleLabel}>
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(e) => setShowRemoved(e.target.checked)}
              aria-label="show removed"
            />
            Show Removed
          </label>
        </span>
      </div>
      {error ? <div style={s.error}>{error}</div> : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visiblePlans.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {visiblePlans.map((p) => (
            <PlanRow
              key={p.id}
              plan={p}
              onRename={(name) => onRenamePlan(p.id, name)}
              onActivate={() => onActivatePlan(p.id)}
              onDeactivate={() => onDeactivatePlan(p.id)}
              onRemove={() => onRemovePlan(p.id)}
              onRestore={() => onRestorePlan(p.id)}
              onOpenFile={() => {
                if (p.filePath) onOpenFile(p.filePath);
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
      {visiblePlans.length === 0 ? (
        <div style={s.desc}>No plans to show — add one below.</div>
      ) : null}
      <div style={s.addRow}>
        <button
          style={s.button}
          onClick={onCreatePlanFromFile}
          data-testid="plan-add-from-file"
        >
          Add Plan from File…
        </button>
      </div>
    </div>
  );
}
