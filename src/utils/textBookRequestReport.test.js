import { buildTextBookRequestIndex, createTextBookRequestReport, normalizeGender } from "./textBookRequestReport";

const classrooms = [
  { id: "8A", grade: 8, section: "A", className: "8A", year: 2026 },
  { id: "8B", grade: 8, section: "B", className: "8B", year: 2026 },
  { id: "12M", grade: 12, section: "M", className: "12M", year: 2026, stream: "Maths" },
  { id: "12A", grade: 12, section: "A", className: "12A", year: 2026, stream: "Arts" },
];
const students = [
  { id: "s1", grade: 8, section: "A", gender: "Male", status: "active" },
  { id: "s2", grade: 8, section: "A", sex: "F", status: "active" },
  { id: "s3", grade: 8, section: "B", gender: "", status: "active" },
  { id: "s4", grade: 8, section: "B", gender: "Male", status: "inactive" },
  { id: "s5", grade: 12, section: "M", gender: "Male", stream: "Maths" },
  { id: "s6", grade: 12, section: "A", gender: "Female", stream: "Arts" },
];
const subjects = [
  { id: "tamil", name: "Tamil", order: 1 },
  { id: "art", name: "Art", order: 2 },
  { id: "music", name: "Music", order: 3 },
  { id: "physics", name: "Physics", subjectNumber: "12" },
  { id: "history", name: "History", subjectNumber: "13" },
];
const enrollments = [
  { id: "e1", studentId: "s1", subjectId: "tamil", year: 2026, status: "active" },
  { id: "e1-duplicate", studentId: "s1", subjectId: "tamil", year: 2026, status: "active" },
  { id: "e2", studentId: "s2", subjectId: "tamil", year: 2026 },
  { id: "e3", studentId: "s3", subjectId: "tamil", year: 2026 },
  { id: "e4", studentId: "s1", subjectId: "art", year: 2026 },
  { id: "e5", studentId: "s2", subjectId: "music", year: 2026 },
  { id: "e6", studentId: "s3", subjectId: "music", year: 2026, status: "inactive" },
  { id: "e7", studentId: "s4", subjectId: "tamil", year: 2026 },
  { id: "e8", studentId: "s5", subjectId: "physics", year: 2026, stream: "Maths" },
  { id: "e9", studentId: "s6", subjectId: "history", year: 2026, stream: "Arts" },
  { id: "wrong-stream", studentId: "s6", subjectId: "physics", year: 2026, stream: "Maths" },
];

function build() {
  return buildTextBookRequestIndex({ students, enrollments, subjects, classrooms, academicYear: 2026 });
}

test("normalizes compatible gender values without silently classifying unknowns", () => {
  expect(normalizeGender({ gender: "M" })).toBe("male");
  expect(normalizeGender({ sex: "girl" })).toBe("female");
  expect(normalizeGender({ gender: "Other" })).toBe("unknown");
});

test("counts active students and grade totals equal class totals", () => {
  const report = createTextBookRequestReport(build(), { scope: "school" });
  expect(report.summary).toEqual({ male: 2, female: 2, unknown: 1, total: 5 });
  const grade8 = report.gradeBreakdown.find((row) => row.grade === 8);
  expect(grade8.total).toBe(3);
  expect(report.classBreakdown.filter((row) => row.grade === 8).reduce((sum, row) => sum + row.total, 0)).toBe(3);
});

test("deduplicates compulsory/optional/aesthetic enrollments and excludes inactive records", () => {
  const report = createTextBookRequestReport(build(), { scope: "grade", grade: 8 });
  expect(report.subjectRows.find((row) => row.name === "Tamil").total).toBe(3);
  expect(report.subjectRows.find((row) => row.name === "Art").total).toBe(1);
  expect(report.subjectRows.find((row) => row.name === "Music").total).toBe(1);
});

test("separates classes and A/L stream-specific subjects", () => {
  const index = build();
  const classReport = createTextBookRequestReport(index, { scope: "class", grade: 8, classId: "8A" });
  expect(classReport.summary.total).toBe(2);
  expect(classReport.subjectRows.find((row) => row.name === "Tamil").total).toBe(2);

  const maths = createTextBookRequestReport(index, { scope: "grade", grade: 12, stream: "Maths" });
  expect(maths.summary.total).toBe(1);
  expect(maths.subjectRows.map((row) => row.name)).toEqual(["Physics"]);
});
