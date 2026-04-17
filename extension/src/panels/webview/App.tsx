import type { PlanStatus } from "@mentor-studio/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LocaleContext } from "./i18n";
import { PlansBoard } from "./PlansBoard";
import { s } from "./styles";
import type { UiPlan } from "./types";
import { useVsCodeBridge } from "./useVsCodeBridge";

function basenameWithoutExt(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  const base = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

export function App(): JSX.Element {
  const { ready, snapshot, sendRequest, pickPlanFile, openFile } =
    useVsCodeBridge();

  const [tentativePlans, setTentativePlans] = useState<UiPlan[]>([]);
  const [planOverrides, setPlanOverrides] = useState<
    Record<number, Partial<UiPlan>>
  >({});
  const [planOrderOverride, setPlanOrderOverride] = useState<number[] | null>(
    null,
  );
  const [plansError, setPlansError] = useState<string | null>(null);

  // Fresh snapshot clears all optimistic state
  useEffect(() => {
    if (!ready) return;
    setTentativePlans([]);
    setPlanOverrides({});
    setPlanOrderOverride(null);
  }, [ready, snapshot]);

  const plans: UiPlan[] = useMemo(() => {
    const visible: UiPlan[] = snapshot.plans.map((p) => ({
      ...p,
      ...planOverrides[p.id],
      pending: planOverrides[p.id]?.pending,
    }));
    let merged: UiPlan[] = [...visible, ...tentativePlans];
    if (planOrderOverride) {
      const byId = new Map(merged.map((p: UiPlan) => [p.id, p]));
      const ordered = planOrderOverride
        .map((id) => byId.get(id))
        .filter((x): x is UiPlan => !!x);
      for (const p of merged) {
        if (!planOrderOverride.includes(p.id)) ordered.push(p);
      }
      merged = ordered;
    }
    return merged;
  }, [snapshot.plans, tentativePlans, planOverrides, planOrderOverride]);

  async function handleCreatePlanFromFile(): Promise<void> {
    setPlansError(null);
    let filePath: string | null;
    try {
      filePath = await pickPlanFile();
    } catch (e) {
      setPlansError(errMsg(e));
      return;
    }
    if (!filePath) return;
    const name = basenameWithoutExt(filePath);
    const tentativeId = -Date.now();
    const tentative: UiPlan = {
      id: tentativeId,
      name,
      filePath,
      status: "backlog",
      sortOrder: 9999,
      pending: true,
    };
    setTentativePlans((prev) => [...prev, tentative]);
    try {
      await sendRequest({ type: "createPlan", name, filePath });
      setTentativePlans((prev) => prev.filter((p) => p.id !== tentativeId));
    } catch (e) {
      setTentativePlans((prev) => prev.filter((p) => p.id !== tentativeId));
      setPlansError(errMsg(e));
    }
  }

  async function handleRenamePlan(id: number, name: string): Promise<void> {
    setPlanOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], name, pending: true },
    }));
    setPlansError(null);
    try {
      await sendRequest({ type: "updatePlan", id, name });
      setPlanOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      setPlanOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setPlansError(errMsg(e));
    }
  }

  const handleSetPlanStatus = useCallback(
    async (id: number, toStatus: PlanStatus): Promise<void> => {
      // Optimistically swap the row's status so the badge doesn't flicker
      // between writeOk and the next snapshot arrival. The override is cleared
      // by the `ready/snapshot` useEffect once a fresh snapshot lands.
      setPlanOverrides((prev) => ({
        ...prev,
        [id]: { ...prev[id], status: toStatus, pending: true },
      }));
      setPlansError(null);
      try {
        await sendRequest({ type: "setPlanStatus", id, toStatus });
      } catch (e) {
        setPlanOverrides((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        const msg = errMsg(e);
        if (msg !== "busy") {
          setPlansError(msg);
        }
      }
    },
    [sendRequest],
  );

  async function handleReorderPlans(orderedIds: number[]): Promise<void> {
    setPlanOrderOverride(orderedIds);
    setPlansError(null);
    try {
      const realIds = orderedIds.filter((id) => id > 0);
      await sendRequest({ type: "reorderPlans", orderedIds: realIds });
    } catch (e) {
      setPlanOrderOverride(null);
      setPlansError(errMsg(e));
    }
  }

  return (
    <LocaleContext.Provider value={snapshot.locale}>
      <div style={s.app}>
        <PlansBoard
          plans={plans}
          onCreatePlanFromFile={() => void handleCreatePlanFromFile()}
          onRenamePlan={(id, name) => void handleRenamePlan(id, name)}
          onSetPlanStatus={(id, toStatus) =>
            void handleSetPlanStatus(id, toStatus)
          }
          onOpenFile={openFile}
          onReorder={(ids) => void handleReorderPlans(ids)}
          error={plansError}
        />
      </div>
    </LocaleContext.Provider>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
