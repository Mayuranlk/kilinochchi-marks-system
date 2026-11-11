import { act, renderHook } from "@testing-library/react";
import { getDocFromServer, getDocsFromServer, onSnapshot } from "firebase/firestore";
import { useSbaTermGate } from "./useSbaTermGate";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: (_db, name) => name, doc: (_db, name, id) => `${name}/${id}`,
  where: (...args) => args, query: (...args) => args,
  onSnapshot: jest.fn(), getDocFromServer: jest.fn(), getDocsFromServer: jest.fn(),
}));
const props = { isAdmin: false, settings: { requireSbaCompletion: true }, term: { id: "t1", year: "2026" },
  classContext: { grade: 6, section: "A" }, subject: { subjectId: "maths", medium: "Tamil" }, assessmentId: "__TERM__",
  students: [{ id: "s1", name: "One", grade: 6, section: "A", medium: "Tamil" }],
  enrollments: [{ id: "e1", studentId: "s1", subjectId: "maths", academicYear: "2026", grade: 6, section: "A", medium: "Tamil" }] };
const saved = { id: "t1~s1~maths", data: () => ({ year: "2026", classKey: "6|A|", mark: 0, absent: false }) };
let receive, fail;
beforeEach(() => {
  jest.clearAllMocks();
  onSnapshot.mockImplementation((_query, _options, next, error) => { receive = next; fail = error; return jest.fn(); });
  getDocFromServer.mockResolvedValue({ data: () => ({ requireSbaCompletion: true }) });
  getDocsFromServer.mockResolvedValue({ docs: [saved] });
});
test("locks until server verification; blank and deletion relock while zero unlocks", () => {
  const { result } = renderHook(() => useSbaTermGate(props));
  expect(result.current.locked).toBe(true);
  act(() => receive({ metadata: { fromCache: true }, docs: [saved] }));
  expect(result.current.locked).toBe(true);
  act(() => receive({ metadata: { fromCache: false }, docs: [] }));
  expect(result.current.reason).toContain("1 of 1");
  act(() => receive({ metadata: { fromCache: false }, docs: [saved] }));
  expect(result.current.locked).toBe(false);
  act(() => receive({ metadata: { fromCache: false }, docs: [] }));
  expect(result.current.locked).toBe(true);
});
test("admin, practice and disabled requirements never subscribe or lock", () => {
  for (const override of [{ isAdmin: true }, { assessmentId: "practice" }, { settings: {} }]) {
    const { result, unmount } = renderHook(() => useSbaTermGate({ ...props, ...override }));
    expect(result.current.locked).toBe(false); unmount();
  }
  expect(onSnapshot).not.toHaveBeenCalled();
});
test("failed reads fail closed and changing class never reuses earlier verification", () => {
  const { result, rerender } = renderHook((input) => useSbaTermGate(input), { initialProps: props });
  act(() => receive({ metadata: { fromCache: false }, docs: [saved] }));
  expect(result.current.locked).toBe(false);
  rerender({ ...props, classContext: { grade: 6, section: "B" } });
  expect(result.current.locked).toBe(true);
  act(() => fail(new Error("permission-denied")));
  expect(result.current.reason).toContain("Could not verify");
});
test("save rechecks current server settings and all rows even after earlier completion", async () => {
  const { result } = renderHook(() => useSbaTermGate(props));
  const rows = [{ studentId: "s1", subjectId: "maths" }];
  await expect(result.current.verifyBeforeSave(rows)).resolves.toBeUndefined();
  getDocsFromServer.mockResolvedValue({ docs: [] });
  await expect(result.current.verifyBeforeSave(rows)).rejects.toThrow("Enter SBA Marks");
  getDocFromServer.mockResolvedValue({ data: () => ({ requireSbaCompletion: false }) });
  await expect(result.current.verifyBeforeSave(rows)).resolves.toBeUndefined();
});

test("subject changes resubscribe narrowly and discard previous verification", () => {
  const { result, rerender } = renderHook((input) => useSbaTermGate(input), { initialProps: props });
  act(() => receive({ metadata: { fromCache: false }, docs: [saved] }));
  expect(result.current.locked).toBe(false);
  rerender({ ...props, subject: { subjectId: "english" } });
  expect(result.current.locked).toBe(true);
  expect(onSnapshot.mock.calls.at(-1)[0]).toEqual(["sbaMarks", ["scopeKey", "==", "t1|6|A|"], ["subjectId", "==", "english"]]);
});
