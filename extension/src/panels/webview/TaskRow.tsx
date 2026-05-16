import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskStatus } from "@mentor-studio/shared";
import type { CSSProperties } from "react";
import { useContext, useEffect, useState } from "react";
import { LocaleContext, t } from "./i18n";
import { s } from "./styles";
import type { UiTask } from "./types";

interface Props {
  task: UiTask;
  reorderable: boolean;
  statusEditable: boolean;
  onRename: (name: string) => void;
  onSetStatus: (toStatus: TaskStatus) => void;
}

const TASK_STATUS_ORDER: TaskStatus[] = [
  "active",
  "queued",
  "completed",
  "skipped",
];

export function TaskRow({
  task,
  reorderable,
  statusEditable,
  onRename,
  onSetStatus,
}: Props): JSX.Element {
  const locale = useContext(LocaleContext);
  const tr = t(locale);
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id, disabled: !reorderable });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);

  useEffect(() => {
    if (!editing) setDraft(task.name);
  }, [task.name, editing]);

  const style: CSSProperties = {
    ...s.taskRow,
    ...(task.pending ? s.rowPending : {}),
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function commit(): void {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.name) onRename(trimmed);
    else setDraft(task.name);
  }

  function renderLeadingControl(): JSX.Element {
    if (reorderable) {
      return (
        <span
          style={s.handle}
          {...attributes}
          {...listeners}
          data-testid="task-handle"
          aria-label={tr.aria.dragHandle}
        >
          ≡
        </span>
      );
    }

    if (task.status === "active") {
      return (
        <span
          style={{ ...s.taskStateIcon, ...s.taskStateIconActive }}
          data-testid="task-status-icon"
          aria-hidden="true"
        >
          ▶
        </span>
      );
    }

    if (task.status === "completed") {
      return (
        <span
          style={{ ...s.taskStateIcon, ...s.taskStateIconCompleted }}
          data-testid="task-status-icon"
          aria-hidden="true"
        >
          ✓
        </span>
      );
    }

    return (
      <span
        style={s.handleHidden}
        data-testid="task-handle"
        aria-label={tr.aria.dragHandle}
      >
        ≡
      </span>
    );
  }

  return (
    <div ref={setNodeRef} style={style} data-testid="task-row">
      {renderLeadingControl()}
      {editing ? (
        <input
          style={s.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(task.name);
              setEditing(false);
            }
          }}
          autoFocus
          aria-label={tr.aria.taskNameInput}
        />
      ) : (
        <span
          style={s.name}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          title={task.name}
        >
          {task.name}
        </span>
      )}
      <select
        style={s.taskStatusSelect}
        value={task.status}
        disabled={!statusEditable}
        onChange={(e) => onSetStatus(e.target.value as TaskStatus)}
      >
        {TASK_STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {tr.taskStatus[status]}
          </option>
        ))}
      </select>
    </div>
  );
}
