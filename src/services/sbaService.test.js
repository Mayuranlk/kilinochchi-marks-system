import { clearFirestoreReadCache } from "./firestoreReadCache";
import { doc, runTransaction, setDoc, getDocs } from "firebase/firestore";
import { saveSbaChange, saveSbaChanges, saveSbaSettings, loadSbaRosterData, loadSbaRecords } from "./sbaService";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, collection, id) => ({ collection, id })),
  collection: (_db, name) => name, documentId: () => "__name__", getDocs: jest.fn(), getDocFromServer: jest.fn(), query: (...args) => args, where: (...args) => args,
  runTransaction: jest.fn(), setDoc: jest.fn(), serverTimestamp: () => "server-time",
  Timestamp: { fromDate: (date) => date.toISOString() },
}));
const context = { term: { id: "t1", year: "2026" }, assignment: { id: "a1", subjectId: "maths", grade: 10, section: "A" }, row: { studentId: "s1", enrollmentId: "e1", studentName: "Student One" }, value: { mark: 20, absent: false }, uid: "teacher", isAdmin: false };
let transaction;
beforeEach(() => {
  jest.clearAllMocks();
  clearFirestoreReadCache();
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

test("roster reads only selected subjects and linked current-year students", async () => {
  const wrap = (id, data) => ({ id, data: () => data });
  getDocs.mockResolvedValueOnce({ docs: [
    wrap("e1", { subjectId: "maths", studentId: "s1", academicYear: "2026" }),
    wrap("e2", { subjectId: "maths", studentId: "old", year: "2025" }),
  ] }).mockResolvedValueOnce({ docs: [wrap("s1", { name: "One" })] });
  const result = await loadSbaRosterData(["maths", "maths"], context.term);
  expect(getDocs.mock.calls).toEqual([
    [["studentSubjectEnrollments", ["subjectId", "==", "maths"]]],
    [["students", ["__name__", "in", ["s1"]]]],
  ]);
  expect(result.enrollments.map((row) => row.id)).toEqual(["e1"]);
  expect(result.students.map((row) => row.id)).toEqual(["s1"]);
});
test("empty subject selection performs no reads", async () => {
  expect(await loadSbaRosterData([], context.term)).toEqual({ students: [], enrollments: [] });
  expect(getDocs).not.toHaveBeenCalled();
});
test("entry scopes marks by subject while register retains all class subjects", async () => {
  getDocs.mockResolvedValue({ docs: [] });
  await loadSbaRecords(context.term, context.assignment, "maths");
  expect(getDocs.mock.calls[0][0]).toEqual(["sbaMarks", ["scopeKey", "==", "t1|10|A|"], ["subjectId", "==", "maths"]]);
  await loadSbaRecords(context.term, context.assignment);
  expect(getDocs.mock.calls[1][0]).toEqual(["sbaMarks", ["scopeKey", "==", "t1|10|A|"]]);
});

test("changing classes reuses subject enrollments and excludes other-class student reads", async () => {
  const wrap = (id, data) => ({ id, data: () => data });
  getDocs.mockResolvedValueOnce({ docs: [
    wrap("a", { subjectId: "maths", studentId: "s1", academicYear: "2026", grade: 10, section: "A", fullClassName: "10A" }),
    wrap("b", { subjectId: "maths", studentId: "s2", academicYear: "2026", grade: 10, section: "B", fullClassName: "10B" }),
    wrap("legacy", { subjectId: "maths", studentId: "s3", academicYear: "2026" }),
  ] }).mockResolvedValue({ docs: [] });
  await loadSbaRosterData(["maths"], context.term, context.assignment);
  await loadSbaRosterData(["maths"], context.term, { ...context.assignment, section: "B" });
  expect(getDocs.mock.calls.filter(([q]) => q[0] === "studentSubjectEnrollments")).toHaveLength(1);
  expect(getDocs.mock.calls[1][0][1]).toEqual(["__name__", "in", ["s1", "s3"]]);
  expect(getDocs.mock.calls[2][0][1]).toEqual(["__name__", "in", ["s2", "s3"]]);
  await loadSbaRosterData(["maths"], context.term, context.assignment);
  expect(getDocs).toHaveBeenCalledTimes(3);
});

test("reconciled mode queries the selected canonical class and year", async () => {
  const previous = process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS;
  process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS = "true";
  try {
    getDocs.mockResolvedValue({ docs: [] });
    await loadSbaRosterData(["maths"], context.term, { ...context.assignment, fullClassName: "10A" });
    expect(getDocs.mock.calls[0][0]).toEqual(["studentSubjectEnrollments",
      ["academicYearKey", "==", "2026"], ["classKey", "==", "10a"], ["subjectId", "==", "maths"]]);
  } finally {
    if (previous === undefined) delete process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS;
    else process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS = previous;
  }
});
