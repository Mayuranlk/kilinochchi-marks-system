import { buildClassMarksReportData } from "./classMarksReportBuilder";
const student = { id: "s1", name: "Example", grade: 10, section: "A", className: "10A", religion: "Hinduism" };
const mark = { studentId: "s1", subjectName: "Mathematics", marks: 60, grade: 10, section: "A", className: "10A", termName: "Term 1", academicYear: 2026 };
const context = { students: [student], marks: [mark], grade: 10, section: "A", className: "10A", termName: "Term 1", year: 2026, rejectDuplicateMarks: true };
test("single-sitting mode rejects duplicate subject records", () => {
  expect(() => buildClassMarksReportData({ ...context, marks: [mark, { ...mark, marks: 80 }] })).toThrow(/Multiple results found/);
});
test("other terms and years cannot overwrite the selected results", () => {
  const report = buildClassMarksReportData({ ...context, marks: [mark, { ...mark, marks: 90, termName: "Term 2" }, { ...mark, marks: 95, academicYear: 2025 }] });
  expect(report.rows[0].marksByColumn.MATHS).toBe(60);
});
