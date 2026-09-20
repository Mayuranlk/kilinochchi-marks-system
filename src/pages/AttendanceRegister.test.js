import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { getCollectionRows } from "../services/firestoreReadCache";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import AttendanceRegister from "./AttendanceRegister";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../services/firestoreReadCache", () => ({ getCollectionRows: jest.fn() }));
jest.mock("file-saver", () => ({ saveAs: jest.fn() }));
jest.mock("jspdf", () => jest.fn().mockImplementation(() => ({ setFont: jest.fn(), setFontSize: jest.fn(), text: jest.fn(), output: () => new Blob(["pdf"], { type: "application/pdf" }) })));
jest.mock("jspdf-autotable", () => jest.fn());
jest.mock("../components/ui", () => ({ PageContainer: ({ children }) => <div>{children}</div> }));
beforeEach(() => {
  jest.clearAllMocks();
  jsPDF.mockImplementation(() => ({ setFont: jest.fn(), setFontSize: jest.fn(), text: jest.fn(), output: () => new Blob(["pdf"], { type: "application/pdf" }) }));
  getCollectionRows.mockImplementation((db, collection) => Promise.resolve(collection === "students" ? [
    { id: "s1", fullName: "Student A", grade: 10, section: "A" },
    { id: "s2", fullName: "Student B", grade: 10, section: "B" },
  ] : [{ id: "a", grade: 10, section: "A" }, { id: "b", grade: 10, section: "B" }]));
});
test("prints blank attendance cells using only class and student data", async () => {
  render(<AttendanceRegister />);
  await screen.findByText("Student A");
  expect(screen.queryByRole("button", { name: /Save Register|Reload register|Retry/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Student A/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "A4 PDF" }));
  await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
  const options = autoTable.mock.calls[0][1];
  expect(options.body[0].slice(0, 2)).toEqual([1, "Student A"]);
  expect(options.body[0].slice(2).every((value) => value === "")).toBe(true);
  expect(getCollectionRows.mock.calls.map((call) => call[1])).toEqual(["students", "classrooms"]);
});
test("changing class updates the printable roster", async () => {
  render(<AttendanceRegister />);
  await screen.findByText("Student A");
  fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
  fireEvent.click(await screen.findByRole("option", { name: "10B" }));
  await screen.findByText("Student B");
  expect(screen.queryByText("Student A")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "A4 PDF" })).toBeEnabled();
});
