export type Narrowed<T> = { ok: true; value: T } | { ok: false; error: string };

export function narrowLimit(raw: unknown, defaultValue = 50): Narrowed<number> {
  const v = raw === undefined ? defaultValue : raw;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 1000) {
    return { ok: false, error: "limit must be integer in [1,1000]" };
  }
  return { ok: true, value: v };
}

export function narrowTopicId(raw: unknown): Narrowed<number | undefined> {
  if (raw === undefined) return { ok: true, value: undefined };
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    return { ok: false, error: "topicId must be integer" };
  }
  return { ok: true, value: raw };
}
