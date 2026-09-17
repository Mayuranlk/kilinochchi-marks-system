import {
  getLocalDateKey,
  getTeacherMarksEntryLockReason,
  isTeacherMarksEntryLocked,
} from "./marksEntryAccess";

describe("teacher marks entry access", () => {
  test("manual admin disable locks entry", () => {
    expect(isTeacherMarksEntryLocked({ teacherEntryEnabled: false }, new Date(2026, 6, 29))).toBe(true);
  });

  test("deadline remains open through the selected date", () => {
    const settings = { teacherEntryEnabled: true, teacherEntryDeadline: "2026-07-29" };
    expect(isTeacherMarksEntryLocked(settings, new Date(2026, 6, 29))).toBe(false);
    expect(isTeacherMarksEntryLocked(settings, new Date(2026, 6, 30))).toBe(true);
    expect(getTeacherMarksEntryLockReason(settings, new Date(2026, 6, 30))).toContain("2026-07-29");
  });

  test("local date keys do not depend on UTC conversion", () => {
    expect(getLocalDateKey(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
