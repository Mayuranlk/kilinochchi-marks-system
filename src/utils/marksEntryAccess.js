export const DEFAULT_MARKS_ENTRY_SETTINGS = {
  teacherEntryEnabled: true,
  teacherEntryDeadline: "",
};

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeMarksEntrySettings(settings = {}) {
  return {
    teacherEntryEnabled: settings.teacherEntryEnabled !== false,
    teacherEntryDeadline: String(settings.teacherEntryDeadline || "").trim(),
  };
}

export function isTeacherMarksEntryLocked(settings = {}, date = new Date()) {
  const normalized = normalizeMarksEntrySettings(settings);
  if (!normalized.teacherEntryEnabled) return true;
  return Boolean(
    normalized.teacherEntryDeadline &&
      getLocalDateKey(date) > normalized.teacherEntryDeadline
  );
}

export function getTeacherMarksEntryLockReason(settings = {}, date = new Date()) {
  const normalized = normalizeMarksEntrySettings(settings);
  if (!normalized.teacherEntryEnabled) {
    return "Marks entry has been disabled by the administrator.";
  }
  if (
    normalized.teacherEntryDeadline &&
    getLocalDateKey(date) > normalized.teacherEntryDeadline
  ) {
    return `The marks entry deadline ended on ${normalized.teacherEntryDeadline}.`;
  }
  return "";
}
