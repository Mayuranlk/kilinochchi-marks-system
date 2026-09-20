import { groupNavigationItems } from "./navigationGroups";

test("preserves every authorized route exactly once, including newly added routes", () => {
  const items = ["/", "/students", "/attendance-register", "/marks", "/backup-restore", "/future-page"].map((path) => ({ path, label: path }));
  const groups = groupNavigationItems(items);
  expect(groups.flatMap((group) => group.items)).toEqual(items);
  expect(groups.find((group) => group.section === "Students & Attendance").items.map((item) => item.path)).toEqual(["/students", "/attendance-register"]);
  expect(groupNavigationItems([])).toEqual([]);
});
