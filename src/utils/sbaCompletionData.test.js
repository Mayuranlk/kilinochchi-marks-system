import { normalizeSbaCompletionMarks } from "./sbaCompletionData";
import { buildClassCompletionRows } from "../pages/reports/ClassCompletionReport";

const terms = [{ id: "term-1", term: "Term 1", year: 2026, startDate: "2026-01-01", endDate: "2026-04-30" }];
const students = [{ id: "s1", grade: 10, section: "A", className: "10A", admissionNo: "12345", emisStudentId: "1" }, { id: "s2", grade: 10, section: "A", className: "10A" }];
const enrollments = ["s1", "s2"].map((studentId) => ({ id: `e-${studentId}`, studentId, subjectId: "maths", subjectName: "Mathematics", grade: 10, section: "A", className: "10A", academicYear: "2026", status: "active" }));
const oldRecord = { id: "term-1~s1~maths", termId: "term-1", year: "2026", studentId: "s1", subjectId: "maths", classKey: "10|A|", enrollmentId: "e-s1", mark: 0, absent: false };

test("old SBA records map to the right class and zero counts as entered", () => {
  const marks = normalizeSbaCompletionMarks([oldRecord], terms, enrollments);
  const [row] = buildClassCompletionRows({ classrooms: [{ id: "c1", grade: 10, section: "A", className: "10A" }], students, enrollments, marks, year: 2026, termName: "Term 1", academicTerm: terms[0] });
  expect(row.expectedMarkCount).toBe(2);
  expect(row.enteredMarkCount).toBe(1);
  expect(row.missingMarksCount).toBe(1);
});

test("absent is completed but blanks and invalid values stay pending", () => {
  const records = [
    { ...oldRecord, id: "zero", mark: 0 },
    { ...oldRecord, id: "absent", mark: null, absent: true },
    { ...oldRecord, id: "blank", mark: null },
    { ...oldRecord, id: "spaces", mark: "  " },
    { ...oldRecord, id: "high", mark: 21 },
  ];
  expect(normalizeSbaCompletionMarks(records, terms, enrollments).map((row) => row.id)).toEqual(["zero", "absent"]);
});

test("records from a different academic term do not count", () => {
  const records = [{ ...oldRecord, termId: "term-2" }];
  const marks = normalizeSbaCompletionMarks(records, [...terms, { id: "term-2", term: "Term 2", year: 2026 }], enrollments);
  const [row] = buildClassCompletionRows({ classrooms: [{ id: "c1", grade: 10, section: "A", className: "10A" }], students, enrollments, marks, year: 2026, termName: "Term 1", academicTerm: terms[0] });
  expect(row.enteredMarkCount).toBe(0);
});

test("a student admitted after a term is not counted as missing SBA", () => {
  const datedStudents = [students[0], { ...students[1], joinDate: "2026-05-01" }];
  const marks = normalizeSbaCompletionMarks([oldRecord], terms, enrollments);
  const [row] = buildClassCompletionRows({ classrooms: [{ id: "c1", grade: 10, section: "A", className: "10A" }], students: datedStudents, enrollments, marks, year: 2026, termName: "Term 1", academicTerm: terms[0] });
  expect(row.expectedMarkCount).toBe(1);
  expect(row.missingMarksCount).toBe(0);
});
