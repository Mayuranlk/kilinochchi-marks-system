import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import MaintenanceControls from "./MaintenanceControls";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("firebase/firestore", () => ({ doc: (_db, collection, id) => `${collection}/${id}`, onSnapshot: jest.fn(), setDoc: jest.fn(), serverTimestamp: () => "server-time" }));
let receive;
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { uid: "admin" }, isAdmin: true });
  onSnapshot.mockImplementation((_ref, _options, next) => { receive = next; return jest.fn(); });
  setDoc.mockResolvedValue(undefined);
});
test("admin explicitly saves independent maintenance settings", async () => {
  render(<MaintenanceControls />);
  expect(screen.getByRole("button", { name: "Save maintenance settings" })).toBeDisabled();
  act(() => receive({ metadata: { fromCache: false }, data: () => undefined }));
  fireEvent.click(screen.getByLabelText("Enable maintenance mode"));
  fireEvent.change(screen.getByLabelText("Message for teachers"), { target: { value: "Back shortly" } });
  expect(setDoc).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save maintenance settings" }));
  expect(await screen.findByText("Maintenance enabled for teachers.")).toBeVisible();
  expect(setDoc).toHaveBeenCalledWith("systemSettings/maintenance", { enabled: true, message: "Back shortly", updatedBy: "admin", updatedAt: "server-time" }, { merge: true });
});
test("non-admin cannot see controls or subscribe", () => {
  useAuth.mockReturnValue({ user: { uid: "teacher" }, isAdmin: false });
  const { container } = render(<MaintenanceControls />);
  expect(container).toBeEmptyDOMElement();
  expect(onSnapshot).not.toHaveBeenCalled();
});
