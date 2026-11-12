import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SBAMarks from "./SBAMarks";
import { getCollectionRows } from "../services/firestoreReadCache";
import { loadSbaRecords, loadSbaRosterData, loadSbaSettings, saveSbaChanges } from "../services/sbaService";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "teacher", email: "teacher@example.test" }, isAdmin: false }) }));
jest.mock("../components/ui", () => ({ PageContainer: ({ title, children }) => <div><h1>{title}</h1>{children}</div>, EmptyState: ({ title }) => <div>{title}</div> }));
jest.mock("../services/firestoreReadCache", () => ({ getCollectionRows: jest.fn() }));
jest.mock("../services/sbaService", () => ({ loadSbaRecords: jest.fn(), loadSbaRosterData: jest.fn(), loadSbaSettings: jest.fn(), saveSbaChanges: jest.fn(), saveSbaSettings: jest.fn() }));
const data = {
  teacherAssignments: [{ id: "a1", teacherId: "teacher", grade: 10, section: "A", fullClassName: "10A", subjectId: "maths", subjectName: "Mathematics" }],
  academicTerms: [{ id: "t1", year: "2026", term: "Term 1", isActive: true }],
  students: [{ id: "s1", name: "Student One", grade: 10, section: "A" }],
  studentSubjectEnrollments: [{ id: "e1", studentId: "s1", subjectId: "maths", grade: 10, section: "A", fullClassName: "10A", academicYear: "2026" }],
};
beforeEach(() => {
  getCollectionRows.mockImplementation(async (_db, collection) => data[collection]);
  loadSbaSettings.mockResolvedValue({ teacherEntryEnabled: true, teacherEntryDeadline: "" });
  loadSbaRecords.mockResolvedValue([]);
  loadSbaRosterData.mockResolvedValue({ students: data.students, enrollments: data.studentSubjectEnrollments });
});
test("failed scoped read prevents entry and printing rather than exposing empty editable results", async () => {
  loadSbaRecords.mockRejectedValue(new Error("permission-denied"));
  render(<SBAMarks registerMode />);
  expect(await screen.findByText(/Could not load SBA marks/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Print / Save A3 PDF" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save SBA marks" })).not.toBeInTheDocument();
});
test("dirty selections lock, failed saves retain edits, and successful saves release selectors", async () => {
  render(<SBAMarks />);
  const input = await screen.findByRole("textbox", { name: "SBA mark for Student One" });
  fireEvent.change(input, { target: { value: "18" } });
  expect(screen.getAllByRole("combobox")[0]).toHaveAttribute("aria-disabled", "true");
  saveSbaChanges.mockResolvedValueOnce({ saved: [], failed: [{ studentId: "s1", message: "Conflict" }] });
  fireEvent.click(screen.getByRole("button", { name: "Save SBA marks" }));
  expect(await screen.findByText(/remaining edits are retained/)).toBeVisible();
  expect(input).toHaveValue("18");
  saveSbaChanges.mockResolvedValueOnce({ saved: [{ id: "t1~s1~maths", studentId: "s1", subjectId: "maths", revision: 1, mark: 18, absent: false }], failed: [] });
  fireEvent.click(screen.getByRole("button", { name: "Save SBA marks" }));
  await waitFor(() => expect(screen.getAllByRole("combobox")[0]).not.toHaveAttribute("aria-disabled", "true"));
  expect(screen.getByText("1 SBA record(s) saved.")).toBeVisible();
});
test("closed SBA controls disable entry without hiding saved results", async () => {
  loadSbaSettings.mockResolvedValue({ teacherEntryEnabled: false });
  loadSbaRecords.mockResolvedValue([{ id: "t1~s1~maths", studentId: "s1", subjectId: "maths", revision: 1, mark: 0, absent: false }]);
  render(<SBAMarks />);
  const input = await screen.findByRole("textbox", { name: "SBA mark for Student One" });
  expect(input).toHaveValue("0");
  expect(input).toBeDisabled();
});

test("opening entry never requests complete student or enrollment collections", async () => {
  getCollectionRows.mockClear();
  render(<SBAMarks />);
  await screen.findByRole("textbox", { name: "SBA mark for Student One" });
  expect(getCollectionRows.mock.calls.map((call) => call[1])).toEqual(["teacherAssignments", "academicTerms"]);
  expect(loadSbaRosterData).toHaveBeenCalledWith(["maths"], expect.objectContaining({ id: "t1" }), expect.objectContaining({ grade: 10 }), { forceRefresh: false });
  expect(loadSbaRecords).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), expect.any(Object), "maths");
});
