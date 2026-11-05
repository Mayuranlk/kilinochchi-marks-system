import { doc, runTransaction, setDoc } from "firebase/firestore";
import { saveSbaChange, saveSbaChanges, saveSbaSettings } from "./sbaService";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, collection, id) => ({ collection, id })),
  collection: jest.fn(), getDocs: jest.fn(), getDocFromServer: jest.fn(), query: jest.fn(), where: jest.fn(),
  runTransaction: jest.fn(), setDoc: jest.fn(), serverTimestamp: () => "server-time",
  Timestamp: { fromDate: (date) => date.toISOString() },
}));
const context = { term: { id: "t1", year: "2026" }, assignment: { id: "a1", subjectId: "maths", grade: 10, section: "A" }, row: { studentId: "s1", enrollmentId: "e1", studentName: "Student One" }, value: { mark: 20, absent: false }, uid: "teacher", isAdmin: false };
let transaction;
beforeEach(() => {
  jest.clearAllMocks();
  doc.mockImplementation((_db, collection, id) => ({ collection, id }));
  transaction = { get: jest.fn(async () => ({ exists: () => false, data: () => ({}) })), set: jest.fn(), delete: jest.fn() };
  runTransaction.mockImplementation((_db, action) => action(transaction));
});
test("SBA save and deletion can only address sbaMarks and sbaEntry, never marks", async () => {
  const result = await saveSbaChange(context);
  expect(result.mark).toBe(20);
  expect(result.revision).toBe(1);
  expect(transaction.set.mock.calls[0][0]).toEqual({ collection: "sbaMarks", id: "t1~s1~maths" });
  await saveSbaChange({ ...context, remove: true, isAdmin: true });
  expect(transaction.delete.mock.calls[0][0].collection).toBe("sbaMarks");
  expect(doc.mock.calls.every(([, collection, id]) => collection === "sbaMarks" || (collection === "systemSettings" && id === "sbaEntry"))).toBe(true);
});
test("conflicting concurrent updates fail without overwriting the saved SBA mark", async () => {
  transaction.get.mockImplementation(async (ref) => ({ exists: () => ref.collection === "sbaMarks", data: () => ({ revision: 2 }) }));
  await expect(saveSbaChange({ ...context, previous: { revision: 1 } })).rejects.toThrow("another session");
  expect(transaction.set).not.toHaveBeenCalled();
});
test("closed SBA entry and teacher deletes are rejected", async () => {
  transaction.get.mockImplementation(async () => ({ exists: () => false, data: () => ({ teacherEntryEnabled: false }) }));
  await expect(saveSbaChange(context)).rejects.toThrow("closed");
  transaction.get.mockImplementation(async () => ({ exists: () => false, data: () => ({}) }));
  await expect(saveSbaChange({ ...context, remove: true })).rejects.toThrow("Only administrators");
  expect(transaction.delete).not.toHaveBeenCalled();
});
test("partial saves return successes and retain failed rows for review", async () => {
  const result = await saveSbaChanges(context, [{ row: context.row, value: context.value }, { row: { ...context.row, studentId: "s2" }, value: { mark: 21 } }]);
  expect(result.saved).toHaveLength(1);
  expect(result.failed).toHaveLength(1);
  expect(result.failed[0].studentId).toBe("s2");
});
test("SBA controls write only their own settings and store a Sri Lanka deadline", async () => {
  await saveSbaSettings({ teacherEntryEnabled: true, teacherEntryDeadline: "2026-11-03" }, "admin");
  expect(setDoc.mock.calls[0][0]).toEqual({ collection: "systemSettings", id: "sbaEntry" });
  expect(setDoc.mock.calls[0][1].teacherEntryDeadlineAt).toBe("2026-11-03T18:29:59.999Z");
});
