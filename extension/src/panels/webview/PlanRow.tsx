import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { useState } from "react";
import { s } from "./styles";
import type { UiPlan } from "./types";

interface Props {
  plan: UiPlan;
  onRename: (name: string) => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onRemove: () => void;
  onRestore: () => void;
  onOpenFile: () => void;
}

export function PlanRow(props: Props): JSX.Element {
  const {
    plan,
    onRename,
    onActivate,
    onDeactivate,
    onRemove,
    onRestore,
    onOpenFile,
  } = props;

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: plan.id });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plan.name);

  const isRemoved = plan.status === "removed";
  const isCompleted = plan.status === "completed";
  const isActive = plan.status === "active";

  const style: CSSProperties = {
    ...s.row,
    ...(plan.pending ? s.rowPending : {}),
    ...(isRemoved ? s.rowRemoved : {}),
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function commit(): void {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== plan.name) {
      onRename(trimmed);
    } else {
      setDraft(plan.name);
    }
  }

  return (
    <div ref={setNodeRef} style={style} data-testid="plan-row">
      <span
        style={s.handle}
        {...attributes}
        {...listeners}
        data-testid="plan-handle"
        aria-label="drag handle"
      >
        ≡
      </span>
      {editing ? (
        <input
          style={s.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(plan.name);
              setEditing(false);
            }
          }}
          autoFocus
          aria-label="plan name input"
        />
      ) : (
        <span
          style={s.name}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          title={plan.name}
        >
          {plan.name}
        </span>
      )}
      <span style={s.badge} data-testid="plan-status">
        {plan.status}
      </span>
      {plan.filePath ? (
        <button
          style={s.buttonGhost}
          onClick={onOpenFile}
          aria-label="open plan file"
        >
          open ↗
        </button>
      ) : null}
      {isRemoved ? (
        <button
          style={s.buttonGhost}
          onClick={onRestore}
          data-testid="plan-restore"
        >
          Restore
        </button>
      ) : (
        <>
          <button
            style={isCompleted ? s.buttonGhost : s.button}
            onClick={isActive ? onDeactivate : onActivate}
            data-testid="plan-toggle-active"
            data-variant={isCompleted ? "ghost" : "primary"}
          >
            {isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            style={s.buttonGhost}
            onClick={onRemove}
            data-testid="plan-remove"
          >
            Remove
          </button>
        </>
      )}
    </div>
  );
}
