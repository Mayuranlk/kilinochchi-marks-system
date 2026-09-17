import { buildClassCompletionRows } from "./ClassCompletionReport";

describe("ClassCompletionReport historical enrollment matching", () => {
  test("counts an inactive historical enrollment when the mark exists for that term", () => {
    const rows = buildClassCompletionRows({
      classrooms: [{ id: "class-1", grade: 10, section: "A", className: "10A" }],
      students: [{
        id: "student-1",
        fullName: "Student One",
        admissionNo: "A-001",
        emisStudentId: "S-001",
        grade: 10,
        section: "A",
        className: "10A",
      }],
      enrollments: [{
        id: "enrollment-1",
        studentId: "student-1",
        subjectName: "Music (Carnatic)",
        subjectNumber: "B2",
        status: "inactive",
        academicYear: 2026,
        grade: 10,
        section: "A",
        className: "10A",
      }],
      marks: [{
        studentId: "student-1",
        subjectName: "Music (Carnatic)",
        termName: "Term 1",
        academicYear: 2026,
        grade: 10,
        section: "A",
        className: "10A",
      }],
      year: 2026,
      termName: "Term 1",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].subjectSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectName: "Music (Carnatic)",
          enteredCount: 1,
          status: "done",
        }),
      ])
    );
  });
});