import { useEffect, useMemo, useState } from "react";
import { PlansBoard } from "./PlansBoard";
import { s } from "./styles";
import type { UiPlan } from "./types";
import { useVsCodeBridge } from "./useVsCodeBridge";

/** Extract a plan name from a filesystem path: strip directories and extension. */
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

  // Optimistic overlays
  const [tentativePlans, setTentativePlans] = useState<UiPlan[]>([]);
  const [planOverrides, setPlanOverrides] = useState<
    Record<number, Partial<UiPlan>>
  >({});
  const [hiddenPlanIds, setHiddenPlanIds] = useState<Set<number>>(new Set());
  const [planOrderOverride, setPlanOrderOverride] = useState<number[] | null>(
    null,
  );

  const [plansError, setPlansError] = useState<string | null>(null);

  // Any fresh snapshot clears overrides (the server is authoritative now).
  useEffect(() => {
    if (!ready) return;
    setTentativePlans([]);
    setPlanOverrides({});
    setHiddenPlanIds(new Set());
    setPlanOrderOverride(null);
  }, [ready, snapshot]);

  // Compose display list from server + overrides
  const plans: UiPlan[] = useMemo(() => {
    const visible: UiPlan[] = snapshot.plans
      .filter((p) => !hiddenPlanIds.has(p.id))
      .map((p) => ({ ...p, ...planOverrides[p.id] }));
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
  }, [
    snapshot.plans,
    tentativePlans,
    planOverrides,
    hiddenPlanIds,
    planOrderOverride,
  ]);

  // ---------- Plan handlers ----------

  // Creates as backlog (no auto-activate). Sidebar's counterpart activates
  // immediately — different UX roles, intentionally split.
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

  async function handleActivatePlan(id: number): Promise<void> {
    setPlanOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: "active", pending: true },
    }));
    setPlansError(null);
    try {
      await sendRequest({ type: "updatePlan", id, status: "active" });
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

  async function handleDeactivatePlan(id: number): Promise<void> {
    setPlanOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: "queued", pending: true },
    }));
    setPlansError(null);
    try {
      await sendRequest({ type: "updatePlan", id, status: "queued" });
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

  async function handleRemovePlan(id: number): Promise<void> {
    setPlanOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: "removed", pending: true },
    }));
    setPlansError(null);
    try {
      await sendRequest({ type: "removePlan", id });
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

  async function handleRestorePlan(id: number): Promise<void> {
    setPlanOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: "backlog", pending: true },
    }));
    setPlansError(null);
    try {
      await sendRequest({ type: "restorePlan", id, toStatus: "backlog" });
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
    <div style={s.app}>
      <PlansBoard
        plans={plans}
        onCreatePlanFromFile={() => void handleCreatePlanFromFile()}
        onRenamePlan={(id, name) => void handleRenamePlan(id, name)}
        onActivatePlan={(id) => void handleActivatePlan(id)}
        onDeactivatePlan={(id) => void handleDeactivatePlan(id)}
        onRemovePlan={(id) => void handleRemovePlan(id)}
        onRestorePlan={(id) => void handleRestorePlan(id)}
        onOpenFile={openFile}
        onReorder={(ids) => void handleReorderPlans(ids)}
        error={plansError}
      />
    </div>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
