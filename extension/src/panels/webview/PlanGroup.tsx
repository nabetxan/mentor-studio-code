import type { PlanStatus } from "@mentor-studio/shared";
import type { ReactNode } from "react";
import { useContext, useState } from "react";
import { LocaleContext, t } from "./i18n";
import { s } from "./styles";

interface Props {
  status: PlanStatus;
  count: number;
  reorderable: boolean;
  defaultOpen: boolean;
  children: ReactNode;
}

export function PlanGroup({
  status,
  count,
  defaultOpen,
  children,
}: Props): JSX.Element {
  const locale = useContext(LocaleContext);
  const label = t(locale).planStatus[status];
  const isEmpty = count === 0;
  const [open, setOpen] = useState(defaultOpen);

  const showChildren = !isEmpty && open;

  return (
    <div>
      <button
        style={isEmpty ? s.groupHeaderDisabled : s.groupHeader}
        aria-disabled={isEmpty}
        aria-expanded={showChildren}
        aria-label={`${label} (${count})`}
        onClick={() => {
          if (!isEmpty) setOpen((prev) => !prev);
        }}
      >
        <span>{showChildren ? "▾" : "▸"}</span>
        <span>{label}</span>
        <span style={{ fontWeight: 400, opacity: 0.7 }}>({count})</span>
      </button>
      {showChildren ? children : null}
    </div>
  );
}
