import React from "react";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import MaintenanceGate from "./MaintenanceGate";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("firebase/firestore", () => ({ doc: (...args) => args, onSnapshot: jest.fn() }));
let receive, fail, unsubscribe;
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { uid: "teacher" }, isTeacher: true, loading: false, logout: jest.fn() });
  unsubscribe = jest.fn();
  onSnapshot.mockImplementation((_ref, _options, next, error) => { receive = next; fail = error; return unsubscribe; });
});
const emit = (data, fromCache = false) => act(() => receive({ data: () => data, metadata: { fromCache } }));
test("teacher pages stay unmounted until server verification; maintenance toggles live", () => {
  const mounted = jest.fn();
  function Page() { mounted(); return <div>Teacher workspace</div>; }
  const { unmount } = render(<MaintenanceGate><Page /></MaintenanceGate>);
  expect(mounted).not.toHaveBeenCalled();
  emit({ enabled: false }, true);
  expect(mounted).not.toHaveBeenCalled();
  emit({ enabled: true, message: "Scheduled updates" });
  expect(screen.getByText("Scheduled updates")).toBeVisible();
  expect(mounted).not.toHaveBeenCalled();
  emit({ enabled: false });
  expect(screen.getByText("Teacher workspace")).toBeVisible();
  emit({ enabled: true });
  expect(screen.queryByText("Teacher workspace")).not.toBeInTheDocument();
  expect(onSnapshot).toHaveBeenCalledTimes(1);
  unmount(); expect(unsubscribe).toHaveBeenCalled();
});
test("missing settings defaults to open, but read failures never open protected pages", () => {
  render(<MaintenanceGate><div>Teacher workspace</div></MaintenanceGate>);
  emit(undefined);
  expect(screen.getByText("Teacher workspace")).toBeVisible();
  act(() => fail(new Error("denied")));
  expect(screen.queryByText("Teacher workspace")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
});
test("admins and logged-out visitors bypass maintenance without a listener", () => {
  useAuth.mockReturnValue({ user: { uid: "admin" }, isAdmin: true, isTeacher: true });
  const { rerender } = render(<MaintenanceGate>Admin workspace</MaintenanceGate>);
  expect(screen.getByText("Admin workspace")).toBeVisible();
  useAuth.mockReturnValue({ user: null });
  rerender(<MaintenanceGate>Login page</MaintenanceGate>);
  expect(screen.getByText("Login page")).toBeVisible();
  expect(onSnapshot).not.toHaveBeenCalled();
});
