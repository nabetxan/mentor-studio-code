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
import type { PlanStatus, TaskStatus } from "@mentor-studio/shared";
import { useContext, useMemo } from "react";
import { LocaleContext, t } from "./i18n";
import { PlanGroup } from "./PlanGroup";
import { PlanRow } from "./PlanRow";
import { s } from "./styles";
import { TaskRow } from "./TaskRow";
import type { UiPlan, UiTask } from "./types";

interface Props {
  plans: UiPlan[];
  tasks?: UiTask[];
  onCreatePlanFromFile: () => void;
  onRenamePlan: (id: number, name: string) => void;
  onSetPlanStatus: (id: number, toStatus: PlanStatus) => void;
  onOpenFile: (filePath: string) => void;
  onReorder: (orderedIds: number[]) => void;
  onReorderQueuedTasks?: (planId: number, queuedTaskIds: number[]) => void;
  onRenameTask?: (id: number, name: string) => void;
  onSetTaskStatus?: (id: number, toStatus: TaskStatus) => void;
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

export interface TaskDisplaySections {
  orderedTasks: UiTask[];
  queuedTasks: UiTask[];
}

export function getTaskDisplaySections(tasks: UiTask[]): TaskDisplaySections {
  return {
    orderedTasks: tasks,
    queuedTasks: tasks.filter((task) => task.status === "queued"),
  };
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
const TASK_VISIBLE: ReadonlySet<PlanStatus> = new Set([
  "active",
  "queued",
  "paused",
  "backlog",
]);

export function PlansBoard(props: Props): JSX.Element {
  const {
    plans,
    tasks = [],
    onCreatePlanFromFile,
    onRenamePlan,
    onSetPlanStatus,
    onOpenFile,
    onReorder,
    onReorderQueuedTasks = () => {},
    onRenameTask = () => {},
    onSetTaskStatus = () => {},
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
  const tasksByPlan = useMemo(() => {
    const map = new Map<number, UiTask[]>();
    for (const task of tasks) {
      const list = map.get(task.planId) ?? [];
      list.push(task);
      map.set(task.planId, list);
    }
    return map;
  }, [tasks]);

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

  function handleTaskDragEnd(planId: number, queuedTasks: UiTask[]) {
    return (ev: DragEndEvent): void => {
      const { active, over } = ev;
      if (!over || active.id === over.id) return;
      const ids = queuedTasks.map((task) => task.id);
      const reordered = computeReorderedIds(
        ids,
        Number(active.id),
        Number(over.id),
      );
      if (reordered !== ids) onReorderQueuedTasks(planId, reordered);
    };
  }

  function renderTasks(plan: UiPlan): JSX.Element | null {
    if (!TASK_VISIBLE.has(plan.status)) return null;
    const planTasks = tasksByPlan.get(plan.id) ?? [];
    if (planTasks.length === 0) {
      return <div style={s.taskEmpty}>{tr.noTasks}</div>;
    }
    const { orderedTasks, queuedTasks } = getTaskDisplaySections(planTasks);
    const taskRow = (task: UiTask, reorderable: boolean): JSX.Element => (
      <TaskRow
        key={task.id}
        task={task}
        reorderable={reorderable}
        statusEditable={plan.status === "active" || task.status !== "active"}
        onRename={(name) => onRenameTask(task.id, name)}
        onSetStatus={(toStatus) => onSetTaskStatus(task.id, toStatus)}
      />
    );

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleTaskDragEnd(plan.id, queuedTasks)}
      >
        <SortableContext
          items={queuedTasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div style={s.taskList} data-testid="task-list">
            {orderedTasks.map((task) =>
              taskRow(task, task.status === "queued"),
            )}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  function renderGroupContent(status: PlanStatus): JSX.Element {
    const groupPlans = grouped.get(status) ?? [];
    const reorderable = REORDERABLE.has(status);

    const rows = groupPlans.map((p) => (
      <div key={p.id}>
        <PlanRow
          plan={p}
          reorderable={reorderable}
          onRename={(name) => onRenamePlan(p.id, name)}
          onSetStatus={(toStatus) => onSetPlanStatus(p.id, toStatus)}
          onOpenFile={() => {
            if (p.filePath) onOpenFile(p.filePath);
          }}
        />
        {renderTasks(p)}
      </div>
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
