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
import { useContext, useMemo } from "react";
import { LocaleContext, t } from "./i18n";
import { PlanGroup } from "./PlanGroup";
import { PlanRow } from "./PlanRow";
import { s } from "./styles";
import type { UiPlan } from "./types";

interface Props {
  plans: UiPlan[];
  onCreatePlanFromFile: () => void;
  onRenamePlan: (id: number, name: string) => void;
  onSetPlanStatus: (id: number, toStatus: PlanStatus) => void;
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

const GROUP_ORDER: PlanStatus[] = [
  "active",
  "queued",
  "paused",
  "backlog",
  "completed",
  "removed",
];

const REORDERABLE: ReadonlySet<PlanStatus> = new Set([
  "queued",
  "paused",
  "backlog",
]);
const DEFAULT_OPEN: ReadonlySet<PlanStatus> = new Set([
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
    onSetPlanStatus,
    onOpenFile,
    onReorder,
    error,
  } = props;
  const locale = useContext(LocaleContext);
  const tr = t(locale).board;

  const grouped = useMemo(() => {
    const map = new Map<PlanStatus, UiPlan[]>();
    for (const status of GROUP_ORDER) map.set(status, []);
    for (const p of plans) {
      map.get(p.status)?.push(p);
    }
    return map;
  }, [plans]);

  const sensors = useSensors(useSensor(PointerSensor));

  /** Build the full ordered ID list across all groups, applying a
   *  within-group reorder to one specific group. The backend's
   *  reorderPlans expects the complete list to avoid sortOrder collisions. */
  function buildFullOrder(
    targetStatus: PlanStatus,
    reorderedGroupIds: number[],
  ): number[] {
    const result: number[] = [];
    for (const st of GROUP_ORDER) {
      if (st === targetStatus) {
        result.push(...reorderedGroupIds);
      } else {
        for (const p of grouped.get(st) ?? []) result.push(p.id);
      }
    }
    return result;
  }

  function handleDragEnd(status: PlanStatus) {
    return (ev: DragEndEvent): void => {
      const { active, over } = ev;
      if (!over || active.id === over.id) return;
      const groupPlans = grouped.get(status) ?? [];
      const ids = groupPlans.map((p) => p.id);
      const reordered = computeReorderedIds(
        ids,
        Number(active.id),
        Number(over.id),
      );
      if (reordered !== ids) onReorder(buildFullOrder(status, reordered));
    };
  }

  function renderGroupContent(status: PlanStatus): JSX.Element {
    const groupPlans = grouped.get(status) ?? [];
    const reorderable = REORDERABLE.has(status);

    const rows = groupPlans.map((p) => (
      <PlanRow
        key={p.id}
        plan={p}
        reorderable={reorderable}
        onRename={(name) => onRenamePlan(p.id, name)}
        onSetStatus={(toStatus) => onSetPlanStatus(p.id, toStatus)}
        onOpenFile={() => {
          if (p.filePath) onOpenFile(p.filePath);
        }}
      />
    ));

    if (reorderable) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd(status)}
        >
          <SortableContext
            items={groupPlans.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {rows}
          </SortableContext>
        </DndContext>
      );
    }

    return <>{rows}</>;
  }

  return (
    <div style={s.pane} data-testid="plans-board">
      <div style={s.header}>
        <span style={s.headerTitle}>{tr.title}</span>
      </div>
      {error ? <div style={s.error}>{error}</div> : null}
      {GROUP_ORDER.map((status) => {
        const groupPlans = grouped.get(status) ?? [];
        return (
          <PlanGroup
            key={status}
            status={status}
            count={groupPlans.length}
            defaultOpen={DEFAULT_OPEN.has(status)}
          >
            {renderGroupContent(status)}
          </PlanGroup>
        );
      })}
      <div style={s.addRow}>
        <button
          style={s.button}
          onClick={onCreatePlanFromFile}
          data-testid="plan-add-from-file"
        >
          {tr.addPlanFromFile}
        </button>
      </div>
    </div>
  );
}
