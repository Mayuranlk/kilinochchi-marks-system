// Merge only edited cells, preserving concurrent changes to other students/days.
export function mergeAttendanceChanges(baseline, draft, latest) {
  const merged = { ...latest };
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(draft)])) {
    const before = baseline[key] || "";
    const next = draft[key] || "";
    if (before === next) continue;
    if (!["", "P", "A", "L"].includes(next)) throw new Error("Invalid attendance status.");
    if ((latest[key] || "") !== before && (latest[key] || "") !== next) {
      throw new Error("Another user changed an edited cell. Discard your changes and reload the register before trying again.");
    }
    merged[key] = next;
  }
  return merged;
}
