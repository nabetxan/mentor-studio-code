export function parseJsonStringArray(raw: unknown): string[] {
  try {
    const v: unknown = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
