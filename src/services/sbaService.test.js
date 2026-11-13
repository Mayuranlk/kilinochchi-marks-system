import { clearFirestoreReadCache } from "./firestoreReadCache";
import { doc, runTransaction, setDoc, getDocs } from "firebase/firestore";
import { saveSbaChange, saveSbaChanges, saveSbaSettings, loadSbaRosterData, loadSbaRecords, loadSbaTeacherAssignments } from "./sbaService";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, collection, id) => ({ collection, id })),
  collection: (_db, name) => name, documentId: () => "__name__", getDocs: jest.fn(), getDocFromServer: jest.fn(), query: (...args) => args, where: (...args) => args, limit: (value) => ["limit", value],
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

test("roster reads are bounded to the selected legacy class scope", async () => {
  const wrap = (id, data) => ({ id, data: () => data });
  getDocs.mockImplementation(async (request) => {
    if (request[0] === "students") return { docs: [wrap("s1", { name: "One" })] };
    const has = (field, value) => request.some((item) => item[0] === field && item[2] === value);
    return has("academicYear", "2026") && has("grade", 10) && has("section", "A")
      ? { docs: [wrap("e1", { subjectId: "maths", studentId: "s1", academicYear: "2026", grade: 10, section: "A", fullClassName: "10A" })] }
      : { docs: [] };
  });
  const result = await loadSbaRosterData(["maths", "maths"], context.term, context.assignment);
  const enrollmentQueries = getDocs.mock.calls.map(([request]) => request).filter((request) => request[0] === "studentSubjectEnrollments");
  expect(enrollmentQueries).toHaveLength(8);
  enrollmentQueries.forEach((request) => {
    expect(request).toContainEqual(["subjectId", "==", "maths"]);
    expect(request).toContainEqual(["limit", 201]);
    expect(request.some((item) => ["academicYear", "year"].includes(item[0]))).toBe(true);
    expect(request.some((item) => item[0] === "grade")).toBe(true);
    expect(request.some((item) => item[0] === "section")).toBe(true);
  });
  expect(result.enrollments.map((row) => row.id)).toEqual(["e1"]);
  expect(result.students.map((row) => row.id)).toEqual(["s1"]);
});
test("empty subject selection performs no reads", async () => {
  expect(await loadSbaRosterData([], context.term)).toEqual({ students: [], enrollments: [] });
  expect(getDocs).not.toHaveBeenCalled();
});
test("teacher assignments use identity-scoped queries instead of a collection scan", async () => {
  const wrap = (id, data) => ({ id, data: () => data });
  getDocs.mockImplementation(async (request) => request.some((item) => item[0] === "teacherId")
    ? { docs: [wrap("a1", { teacherId: "teacher", subjectId: "maths" })] }
    : { docs: [] });
  const rows = await loadSbaTeacherAssignments({ uid: "teacher", email: "teacher@example.test" });
  expect(rows.map((row) => row.id)).toEqual(["a1"]);
  expect(getDocs).toHaveBeenCalledTimes(5);
  getDocs.mock.calls.forEach(([request]) => {
    expect(request[0]).toBe("teacherAssignments");
    expect(request).toContainEqual(["limit", 201]);
  });
});
test("entry scopes marks by subject while register retains all class subjects", async () => {
  getDocs.mockResolvedValue({ docs: [] });
  await loadSbaRecords(context.term, context.assignment, "maths");
  expect(getDocs.mock.calls[0][0]).toEqual(["sbaMarks", ["scopeKey", "==", "t1|10|A|"], ["subjectId", "==", "maths"], ["limit", 201]]);
  await loadSbaRecords(context.term, context.assignment);
  expect(getDocs.mock.calls[1][0]).toEqual(["sbaMarks", ["scopeKey", "==", "t1|10|A|"]]);
});
