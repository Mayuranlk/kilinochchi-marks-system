import { buildLiveRows } from "./MarksStatusLive";

const baseClassroom = { id: "class-6a", grade: 6, section: "A", className: "6A", year: 2026 };
const baseStudent = {
  id: "student-1",
  fullName: "Student One",
  grade: 6,
  section: "A",
  className: "6A",
};

const buildRows = ({ students, enrollments, marks }) =>
  buildLiveRows({
    classrooms: [baseClassroom],
    students,
    enrollments,
    marks,
    assignments: [],
    terms: [{ term: "Term 1", year: 2026, startDate: "2026-01-01" }],
    year: 2026,
    termName: "Term 1",
  });

describe("MarksStatusLive term-scoped completion", () => {
  test("keeps a changed Grade 6 subject in Term 1 when its historical mark exists", () => {
    const rows = buildRows({
      students: [baseStudent],
      enrollments: [
        {
          studentId: "student-1",
          subjectName: "Music",
          status: "inactive",
          academicYear: 2026,
          grade: 6,
          section: "A",
          className: "6A",
        },
        {
          studentId: "student-1",
          subjectName: "Art",
          status: "active",
          academicYear: 2026,
          grade: 6,
          section: "A",
          className: "6A",
        },
      ],
      marks: [{
        studentId: "student-1",
        subjectName: "Music",
        termName: "Term 1",
        academicYear: 2026,
        grade: 6,
        section: "A",
        className: "6A",
      }],
    });

    expect(rows[0].subjectSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectName: "Music", enrolledCount: 1, enteredCount: 1 }),
      ])
    );
    expect(rows[0].subjectSummaries).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ subjectName: "Art" })])
    );
  });

  test("does not add a Term 2 joiner to Term 1 expectations", () => {
    const rows = buildRows({
      students: [{ ...baseStudent, joinDate: "2026-06-01" }],
      enrollments: [{
        studentId: "student-1",
        subjectName: "Mathematics",
        status: "active",
        academicYear: 2026,
        grade: 6,
        section: "A",
        className: "6A",
      }],
      marks: [],
    });

    expect(rows[0].studentCount).toBe(0);
    expect(rows[0].expectedMarkCount).toBe(0);
    expect(rows[0].status).toBe("missing");
  });

  test("keeps a student with Term 1 marks even when the stored join date is later", () => {
    const rows = buildRows({
      students: [{ ...baseStudent, joinDate: "2026-06-01" }],
      enrollments: [{
        studentId: "student-1",
        subjectName: "Mathematics",
        status: "active",
        academicYear: 2026,
        grade: 6,
        section: "A",
        className: "6A",
      }],
      marks: [{
        studentId: "student-1",
        subjectName: "Mathematics",
        termName: "Term 1",
        academicYear: 2026,
        grade: 6,
        section: "A",
        className: "6A",
      }],
    });

    expect(rows[0].studentCount).toBe(1);
    expect(rows[0].expectedMarkCount).toBe(1);
    expect(rows[0].enteredMarkCount).toBe(1);
    expect(rows[0].status).toBe("done");
  });
});
