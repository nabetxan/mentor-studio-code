import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PlanStatus } from "@mentor-studio/shared";
import type { CSSProperties } from "react";
import { useContext, useEffect, useState } from "react";
import { LocaleContext, t } from "./i18n";
import { OpenExternalIcon } from "./icons";
import { StatusMenu } from "./StatusMenu";
import { s } from "./styles";
import type { UiPlan } from "./types";

interface Props {
  plan: UiPlan;
  reorderable: boolean;
  onRename: (name: string) => void;
  onSetStatus: (toStatus: PlanStatus) => void;
  onOpenFile: () => void;
}

export function PlanRow({
  plan,
  reorderable,
  onRename,
  onSetStatus,
  onOpenFile,
}: Props): JSX.Element {
  const locale = useContext(LocaleContext);
  const tr = t(locale);
  const labels = tr.planStatus;

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: plan.id });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plan.name);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(plan.name);
  }, [plan.name, editing]);

  const isActive = plan.status === "active";
  const isRemoved = plan.status === "removed";

  const style: CSSProperties = {
    ...s.row,
    ...(plan.pending ? s.rowPending : {}),
    ...(isRemoved ? s.rowRemoved : {}),
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
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
        style={reorderable ? s.handle : s.handleHidden}
        {...(reorderable ? { ...attributes, ...listeners } : {})}
        data-testid="plan-handle"
        aria-label={tr.aria.dragHandle}
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
          aria-label={tr.aria.planNameInput}
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
      <span style={{ position: "relative", display: "inline-block" }}>
        <button
          style={isActive ? s.badgeButtonActive : s.badgeButton}
          data-testid="plan-status-btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          {labels[plan.status]} ▾
        </button>
        {menuOpen ? (
          <StatusMenu
            currentStatus={plan.status}
            onSelect={(toStatus) => {
              setMenuOpen(false);
              onSetStatus(toStatus);
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null}
      </span>
      {plan.filePath ? (
        <button
          style={{ ...s.buttonGhost, gap: 4 }}
          onClick={onOpenFile}
          aria-label={tr.aria.openPlanFile}
        >
          {tr.board.openPlanFile}
          <OpenExternalIcon />
        </button>
      ) : null}
    </div>
  );
}
