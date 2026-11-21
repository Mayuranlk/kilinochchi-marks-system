import { buildClassCompletionRows } from "./ClassCompletionReport";

describe("ClassCompletionReport historical enrollment matching", () => {
  test("counts a student only in terms overlapping admission and leaving dates", () => {
    const student = { id: "student-1", grade: 10, section: "A", className: "10A", admissionNo: "12345", emisStudentId: "e1", joinDate: "2026-05-20", leftDate: "2026-07-10", status: "Left" };
    const input = { classrooms: [{ id: "c", grade: 10, section: "A", className: "10A" }], students: [student], enrollments: [{ studentId: student.id, subjectId: "maths", subjectName: "Maths", status: "active", academicYear: 2026, grade: 10, section: "A", className: "10A" }], marks: [], year: 2026 };
    const term1 = { startDate: "2026-01-01", endDate: "2026-04-30" };
    const term2 = { startDate: "2026-05-01", endDate: "2026-08-31" };
    const term3 = { startDate: "2026-09-01", endDate: "2026-12-31" };
    expect(buildClassCompletionRows({ ...input, academicTerm: term1, termName: "Term 1" })[0].expectedMarkCount).toBe(0);
    expect(buildClassCompletionRows({ ...input, academicTerm: term2, termName: "Term 2" })[0].expectedMarkCount).toBe(1);
    expect(buildClassCompletionRows({ ...input, academicTerm: term3, termName: "Term 3" })[0].expectedMarkCount).toBe(0);
  });
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


test("matches teachers by class, subject and year and lists each teacher once", () => {
  const rows = buildClassCompletionRows({
    classrooms: [{ id: "c", grade: 10, section: "A", className: "10A" }],
    students: [{ id: "s", grade: 10, section: "A", className: "10A" }],
    enrollments: [{ studentId: "s", subjectId: "math", subjectName: "Maths", academicYear: 2026, grade: 10, section: "A", className: "10A" }],
    marks: [], year: 2026, termName: "Term 1",
    assignments: [
      { teacherName: "Teacher A", subjectId: "math", grade: 10, section: "A" },
      { teacherName: "Teacher A", subjectId: "math", grade: 10, section: "A" },
      { teacherName: "Teacher B", subjectId: "math", grade: 10, section: "A", year: 2026 },
      { teacherName: "Other class", subjectId: "math", grade: 10, section: "B" },
      { teacherName: "Other subject", subjectId: "science", grade: 10, section: "A" },
      { teacherName: "Other year", subjectId: "math", grade: 10, section: "A", year: 2025 },
      { teacherName: "Inactive", subjectId: "math", grade: 10, section: "A", status: "inactive" },
    ],
  });
  expect(rows[0].subjectSummaries[0].teacherNames).toEqual(["Teacher A", "Teacher B"]);
});
