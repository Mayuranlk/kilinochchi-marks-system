import { mergeAttendanceChanges } from "./attendanceRegisterLogic";
import { classroomsForYear, matchesRegisterClass, monthDays, displayMonth } from "./registerContext";

test("attendance merges unrelated concurrent edits and preserves clearing a cell", () => {
  expect(mergeAttendanceChanges({ s1: "P" }, { s1: "" }, { s1: "P", s2: "A" })).toEqual({ s1: "", s2: "A" });
});
test("conflicting edits fail instead of silently overwriting", () => {
  expect(() => mergeAttendanceChanges({ s1: "P" }, { s1: "A" }, { s1: "L" })).toThrow(/Another user/);
  expect(mergeAttendanceChanges({ s1: "P" }, { s1: "A" }, { s1: "A" })).toEqual({ s1: "A" });
});
test("invalid status is rejected", () => {
  expect(() => mergeAttendanceChanges({}, { s1: "X" }, {})).toThrow(/Invalid/);
});
test("class options respect academic year and deduplicate legacy classrooms", () => {
  const base = { grade: 10, section: "A", className: "10A" };
  const rooms = classroomsForYear([
    { ...base, id: "legacy" }, { ...base, id: "old", year: 2025 },
    { ...base, id: "current", academicYear: 2026 },
    { ...base, id: "inactive", section: "B", status: "Inactive" },
  ], "2026");
  expect(rooms.map((room) => room.id)).toEqual(["current"]);
});
test("A/L class matching does not mix streams with the same section", () => {
  const room = { id: "arts", grade: 12, section: "A", stream: "Arts", className: "12 Arts A" };
  expect(matchesRegisterClass({ grade: 12, section: "A", stream: "Commerce" }, room, "2026")).toBe(false);
  expect(matchesRegisterClass({ grade: 12, section: "A", stream: "Arts" }, room, "2026")).toBe(true);
  expect(matchesRegisterClass({ classroomId: "other", grade: 12, section: "A", stream: "Arts" }, room, "2026")).toBe(false);
  expect(matchesRegisterClass({ classroomId: "arts", academicYear: 2025 }, room, "2026")).toBe(false);
});
test("calendar and exports use the selected year including leap February", () => {
  expect(monthDays("2024", "2")).toHaveLength(29);
  expect(monthDays("2026", "2")).toHaveLength(28);
  expect(displayMonth("2026", "9")).toBe("September 2026");
});
