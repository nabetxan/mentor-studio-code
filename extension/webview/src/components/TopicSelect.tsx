import type { Locale, TopicConfig } from "@mentor-studio/shared";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

interface TopicSelectProps {
  options: TopicConfig[];
  value: string;
  onChange: (key: string) => void;
  onAddTopic?: (label: string) => void;
  addTopicError?: string | null;
  lastAddedKey?: string | null;
  onClearLastAddedKey?: () => void;
  locale: Locale;
  placeholder?: string;
  ariaLabel?: string;
}

export function TopicSelect({
  options,
  value,
  onChange,
  onAddTopic,
  addTopicError,
  lastAddedKey,
  onClearLastAddedKey,
  locale,
  placeholder,
  ariaLabel,
}: TopicSelectProps) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const showAddNew = Boolean(onAddTopic);
  const selectedLabel =
    options.find((o) => o.key === value)?.label ?? placeholder ?? "—";

  // Auto-select newly added topic and clear input on success
  useEffect(() => {
    if (lastAddedKey) {
      if (open) {
        onChange(lastAddedKey);
        setNewLabel("");
      }
      onClearLastAddedKey?.();
    }
  }, [lastAddedKey, onChange, open, onClearLastAddedKey]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(key: string) {
    onChange(key);
    setOpen(false);
  }

  function handleAdd() {
    if (!onAddTopic) return;
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    onAddTopic(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Check if sanitized key would be empty (non-ASCII only input)
  const sanitizedKey = newLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const addDisabled = !newLabel.trim() || !sanitizedKey;

  return (
    <div className="topic-select" ref={containerRef}>
      <button
        className="form-select"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        {selectedLabel}
      </button>
      {open && (
        <div className="topic-select-dropdown">
          <div
            role="listbox"
            aria-label={ariaLabel ?? t("overview.topic.mergeTo", locale)}
          >
            {[...options]
              .sort((a, b) =>
                a.label.localeCompare(b.label, undefined, { numeric: true }),
              )
              .map((opt) => (
                <button
                  key={opt.key}
                  role="option"
                  aria-selected={opt.key === value}
                  className={`topic-select-item${opt.key === value ? " selected" : ""}`}
                  onClick={() => handleSelect(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
          </div>
          {showAddNew && (
            <>
              <div className="topic-select-separator" />
              <div className="topic-select-add">
                <div className="form-row">
                  <button
                    className="btn-primary"
                    disabled={addDisabled}
                    onClick={handleAdd}
                  >
                    +
                  </button>
                  <input
                    className="form-input"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("overview.topic.newTopic", locale)}
                  />
                </div>
                {addTopicError && (
                  <div className="topic-select-error">{addTopicError}</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
