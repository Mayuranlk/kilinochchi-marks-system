import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import Layout from "./Layout";
import { useAuth } from "../context/AuthContext";

jest.mock("react-router-dom", () => {
  const React = require("react");
  const Context = React.createContext(null);
  return {
    MemoryRouter: ({ initialEntries, children }) => {
      const [pathname, navigate] = React.useState(initialEntries[0]);
      return <Context.Provider value={{ pathname, navigate }}>{children}</Context.Provider>;
    },
    useLocation: () => ({ pathname: React.useContext(Context).pathname }),
    useNavigate: () => React.useContext(Context).navigate,
    Outlet: () => null,
  };
}, { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../theme/ColorModeContext", () => ({ useColorMode: () => ({ mode: "light", cycleMode: jest.fn() }) }));
jest.mock("./ui", () => ({ AppErrorBoundary: ({ children }) => children, BrandMark: () => <span>School</span> }));
const theme = createTheme({ custom: { highContrast: false, shadows: { floating: "none" } } });
const mount = (path = "/attendance-register") => render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={[path]}><Layout /></MemoryRouter></ThemeProvider>);
beforeEach(() => {
  window.localStorage.clear();
  useAuth.mockReturnValue({ profile: { name: "Administrator", role: "admin" }, isAdmin: true, assignedGrades: [], logout: jest.fn() });
});

test("opens the current section and expands only one section at a time", async () => {
  mount();
  const nav = within(screen.getByRole("navigation", { name: "Primary navigation" }));
  expect(nav.getByRole("button", { name: "Students & Attendance" })).toHaveAttribute("aria-expanded", "true");
  expect(nav.getByRole("button", { name: "Attendance Register" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(nav.getByRole("button", { name: "Reports & Analysis" }));
  expect(nav.getByRole("button", { name: "Reports & Analysis" })).toHaveAttribute("aria-expanded", "true");
  expect(nav.getByRole("button", { name: "Students & Attendance" })).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(nav.getByText("Grade Result Sheet"));
  await waitFor(() => expect(nav.getByRole("button", { name: "Grade Result Sheet" })).toHaveAttribute("aria-current", "page"));
});

test("compact section icons expand the sidebar and reveal their child pages", () => {
  window.localStorage.setItem("kcc-sidebar-collapsed", "true");
  mount("/");
  fireEvent.click(screen.getByRole("button", { name: "Administration" }));
  expect(screen.getByRole("button", { name: "Administration" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Backup & Restore")).toBeInTheDocument();
  expect(window.localStorage.getItem("kcc-sidebar-collapsed")).toBe("false");
});

test("teachers do not receive administrator pages", () => {
  useAuth.mockReturnValue({ profile: { name: "Teacher", role: "teacher" }, isTeacher: true, assignedGrades: [], logout: jest.fn() });
  mount("/teacher");
  expect(screen.queryByRole("button", { name: "Administration" })).not.toBeInTheDocument();
  expect(screen.queryByText("Backup & Restore")).not.toBeInTheDocument();
  expect(screen.getByText("SBA Marks Entry")).toBeInTheDocument();
  expect(screen.queryByText("SBA Class Register")).not.toBeInTheDocument();
  expect(screen.queryByText("SBA Blank Sheet")).not.toBeInTheDocument();
});
