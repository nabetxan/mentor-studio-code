import type { TaskStatus } from "@mentor-studio/shared";
import { useContext, useEffect, useRef, useState } from "react";
import { LocaleContext, t } from "./i18n";
import { s } from "./styles";

const TASK_STATUS_ORDER: TaskStatus[] = [
  "active",
  "queued",
  "completed",
  "skipped",
];

interface Props {
  currentStatus: TaskStatus;
  onSelect: (toStatus: TaskStatus) => void;
  onClose: () => void;
}

export function TaskStatusMenu({
  currentStatus,
  onSelect,
  onClose,
}: Props): JSX.Element {
  const locale = useContext(LocaleContext);
  const labels = t(locale).taskStatus;
  const [focusIndex, setFocusIndex] = useState(
    TASK_STATUS_ORDER.indexOf(currentStatus),
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleScroll(): void {
      onClose();
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  function handleKeyDown(e: React.KeyboardEvent): void {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, TASK_STATUS_ORDER.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const target = TASK_STATUS_ORDER[focusIndex];
        if (target === currentStatus) {
          onClose();
        } else {
          onSelect(target);
        }
        break;
      }
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      style={s.statusMenu}
      onKeyDown={handleKeyDown}
    >
      {TASK_STATUS_ORDER.map((status, i) => {
        const isCurrent = status === currentStatus;
        return (
          <button
            key={status}
            role="menuitem"
            style={{
              ...s.statusMenuItem,
              ...(i === focusIndex
                ? {
                    background:
                      "var(--vscode-list-hoverBackground, rgba(255,255,255,0.05))",
                  }
                : {}),
              ...(isCurrent ? s.statusMenuItemActive : {}),
            }}
            onClick={() => {
              if (isCurrent) {
                onClose();
              } else {
                onSelect(status);
              }
            }}
            onMouseEnter={() => setFocusIndex(i)}
          >
            <span style={{ width: 16, display: "inline-block" }}>
              {isCurrent ? "✓ " : ""}
            </span>
            {labels[status]}
          </button>
        );
      })}
    </div>
  );
}
