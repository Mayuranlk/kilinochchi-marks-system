import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { createAppTheme } from "../theme/appTheme";
import { onSnapshot } from "firebase/firestore";
import { getCollectionRows } from "../services/firestoreReadCache";
import { buildTeacherDashboardData, dashboardStudentIds } from "./TeacherDashboard";
import TeacherDashboard from "./TeacherDashboard";
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../firebase", () => ({ auth: { currentUser: { uid: "teacher-1", email: "teacher@example.test" } }, db: {} }));
jest.mock("../services/firestoreReadCache", () => ({ getCollectionRows: jest.fn() }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(), doc: jest.fn(), documentId: jest.fn(), getDocs: jest.fn(),
  onSnapshot: jest.fn(), query: jest.fn(), where: jest.fn(), limit: jest.fn(), orderBy: jest.fn(), startAfter: jest.fn(),
}));

test("selects enrollment students for the teacher's classes and class teacher's class", () => {
  const user = { uid: "teacher-1", email: "teacher@example.test" };
  const assignments = [
    { teacherId: "teacher-1", grade: 6, section: "A", status: "active" },
    { teacherId: "other", grade: 6, section: "B", status: "active" },
    { teacherId: "teacher-1", grade: 6, section: "C", status: "inactive" },
  ];
  const enrollments = [
    { studentId: "one", grade: 6, section: "A" },
    { studentId: "one", grade: 6, section: "A" },
    { studentId: "two", grade: 6, section: "B" },
    { studentId: "three", grade: 6, section: "C" },
  ];
  expect(dashboardStudentIds(enrollments, assignments, user, null)).toEqual(["one"]);
  expect(dashboardStudentIds(enrollments, assignments, user, { grade: 6, section: "B" })).toEqual(["one", "two"]);
});

test("student-scoped marks preserve subject and class-teacher progress", () => {
  const user = { uid: "teacher-1", email: "teacher@example.test" };
  const assignments = [
    { teacherId: "teacher-1", grade: 6, section: "A", fullClassName: "6A", subjectId: "music", subjectName: "Music" },
    { teacherId: "other", grade: 6, section: "A", fullClassName: "6A", subjectId: "art", subjectName: "Art" },
  ];
  const classrooms = [{ grade: 6, section: "A", fullClassName: "6A", classTeacherId: "teacher-1" }];
  const enrollments = [
    { studentId: "one", grade: 6, section: "A", fullClassName: "6A", subjectId: "music", academicYear: "2026", status: "active" },
    { studentId: "two", grade: 6, section: "A", fullClassName: "6A", subjectId: "art", academicYear: "2026", status: "active" },
    { studentId: "other", grade: 6, section: "B", fullClassName: "6B", subjectId: "music", academicYear: "2026", status: "active" },
  ];
  const allMarks = [
    { studentId: "one", grade: 6, section: "A", fullClassName: "6A", subjectId: "music", academicYear: "2026", term: "Term 2" },
    { studentId: "two", grade: 6, section: "A", fullClassName: "6A", subjectId: "art", academicYear: "2026", term: "Term 2" },
    { studentId: "other", grade: 6, section: "B", fullClassName: "6B", subjectId: "music", academicYear: "2026", term: "Term 2" },
  ];
  const ids = dashboardStudentIds(enrollments, assignments, user, classrooms[0]);
  const input = { user, users: [], assignments, classrooms, enrollments, students: [], sortedTerms: [{ id: "term-2", year: "2026", term: "Term 2" }], effectiveTermKey: "Term 2__2026", progressReady: true };
  const full = buildTeacherDashboardData({ ...input, marks: allMarks });
  const scoped = buildTeacherDashboardData({ ...input, marks: allMarks.filter((mark) => ids.includes(mark.studentId)) });
  expect(full.subjectRows[0].done).toBe(1);
  expect(full.classTeacherData.subjects).toHaveLength(2);
  expect(scoped.subjectRows).toEqual(full.subjectRows);
  expect(scoped.classTeacherData).toEqual(full.classTeacherData);
});

test("student-scoped marks preserve a subject change across terms", () => {
  const user = { uid: "teacher-1", email: "teacher@example.test" };
  const base = { grade: 6, section: "A", fullClassName: "6A" };
  const assignments = ["art", "music"].map((subjectId) => ({ ...base, subjectId, teacherId: user.uid }));
  const classrooms = [{ ...base, classTeacherId: user.uid }];
  const enrollments = [
    { ...base, studentId: "one", subjectId: "art", academicYear: "2026", status: "inactive", subjectTermIds: ["term-2"] },
    { ...base, studentId: "one", subjectId: "music", academicYear: "2026", status: "active", subjectTermIds: ["term-3"] },
  ];
  const marks = [
    { ...base, studentId: "one", subjectId: "art", academicYear: "2026", term: "Term 2" },
    { ...base, studentId: "one", subjectId: "music", academicYear: "2026", term: "Term 3" },
  ];
  const ids = dashboardStudentIds(enrollments, assignments, user, classrooms[0]);
  const input = { user, users: [], assignments, classrooms, enrollments, students: [], sortedTerms: [
    { id: "term-2", year: "2026", term: "Term 2" },
    { id: "term-3", year: "2026", term: "Term 3" },
  ], progressReady: true };
  for (const [key, expectedSubject] of [["Term 2__2026", "art"], ["Term 3__2026", "music"]]) {
    const full = buildTeacherDashboardData({ ...input, marks, effectiveTermKey: key });
    const scoped = buildTeacherDashboardData({ ...input, marks: marks.filter((mark) => ids.includes(mark.studentId)), effectiveTermKey: key });
    expect(full.subjectRows.map((row) => row.subjectId)).toEqual([expectedSubject]);
    expect(full.subjectRows[0].done).toBe(1);
    expect(scoped.subjectRows).toEqual(full.subjectRows);
    expect(scoped.classTeacherData).toEqual(full.classTeacherData);
  }
});

test("opening dashboard skips broad reads until the teacher requests progress", async () => {
  onSnapshot.mockImplementation(() => () => {});
  getCollectionRows.mockImplementation(async (_db, name) => {
    if (name === "teacherAssignments") return [{ teacherId: "teacher-1", grade: 6, section: "A", fullClassName: "6A", subjectId: "art", subjectName: "Art" }];
    return [];
  });
  render(<ThemeProvider theme={createAppTheme()}><TeacherDashboard /></ThemeProvider>);
  const button = await screen.findByRole("button", { name: "Load progress" });
  const initialReads = getCollectionRows.mock.calls.map((call) => call[1]);
  expect(initialReads).not.toContain("marks");
  expect(initialReads).not.toContain("studentSubjectEnrollments");
  expect(initialReads).not.toContain("students");
  fireEvent.click(button);
  await waitFor(() => {
    const reads = getCollectionRows.mock.calls.map((call) => call[1]);
    expect(reads).toEqual(expect.arrayContaining(["marks", "studentSubjectEnrollments"]));
  });
});

test("unassigned teachers see no progress request and cause no broad reads", async () => {
  onSnapshot.mockImplementation(() => () => {});
  getCollectionRows.mockReset();
  getCollectionRows.mockResolvedValue([]);
  render(<ThemeProvider theme={createAppTheme()}><TeacherDashboard /></ThemeProvider>);
  await screen.findByText("No assignments");
  expect(screen.queryByRole("button", { name: "Load progress" })).toBeNull();
  expect(getCollectionRows.mock.calls.map((call) => call[1])).not.toEqual(expect.arrayContaining(["marks"]));
});
