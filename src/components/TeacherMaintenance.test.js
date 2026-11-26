import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { TeacherMaintenanceControl, TeacherMaintenanceGate } from "./TeacherMaintenance";

jest.mock("../firebase", () => ({ db: {}, auth: { currentUser: { uid: "admin" } } }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn(() => "settings"), onSnapshot: jest.fn(), setDoc: jest.fn(), serverTimestamp: jest.fn(() => "timestamp") }));

let deliver;
beforeEach(() => {
  doc.mockReturnValue("settings");
  onSnapshot.mockImplementation((_doc, _options, next) => { deliver = next; return jest.fn(); });
  useAuth.mockReturnValue({ user: { uid: "teacher" }, loading: false, isTeacher: true, isAdmin: false, logout: jest.fn() });
});
function snapshot(enabled, fromCache = false) {
  act(() => deliver({ metadata: { fromCache, hasPendingWrites: false }, exists: () => true, data: () => ({ enabled }) }));
}

test("holds teacher pages until the server confirms the setting and blocks them during maintenance", () => {
  render(<TeacherMaintenanceGate><div>Teacher data</div></TeacherMaintenanceGate>);
  expect(screen.queryByText("Teacher data")).not.toBeInTheDocument();
  snapshot(false, true);
  expect(screen.queryByText("Teacher data")).not.toBeInTheDocument();
  snapshot(true);
  expect(screen.getByText("Teacher portal under maintenance")).toBeInTheDocument();
  expect(screen.queryByText("Teacher data")).not.toBeInTheDocument();
  snapshot(false);
  expect(screen.getByText("Teacher data")).toBeInTheDocument();
});

test("administrators bypass the teacher gate", () => {
  useAuth.mockReturnValue({ user: { uid: "admin" }, loading: false, isTeacher: true, isAdmin: true });
  render(<TeacherMaintenanceGate><div>Admin page</div></TeacherMaintenanceGate>);
  expect(screen.getByText("Admin page")).toBeInTheDocument();
  expect(onSnapshot).not.toHaveBeenCalled();
});

test("admin switch writes the selected maintenance state", async () => {
  setDoc.mockResolvedValue();
  render(<TeacherMaintenanceControl />);
  snapshot(false);
  await act(async () => { fireEvent.click(screen.getByRole("switch")); });
  expect(setDoc).toHaveBeenCalledWith("settings", expect.objectContaining({ enabled: true, updatedBy: "admin" }), { merge: true });
});
