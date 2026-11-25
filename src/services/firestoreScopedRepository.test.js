import { collection, getDocs, query, where } from "firebase/firestore";
import { queryEnrollmentsByScope, queryMarksByStudentIds, queryTeacherAssignmentsByScope } from "./firestoreScopedRepository";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "enrollments"),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  query: jest.fn((collection, ...constraints) => ({ collection, constraints })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  limit: jest.fn(), orderBy: jest.fn(), startAfter: jest.fn(),
}));

const scope = { academicYearKey: "2026", classKey: "6-a", subjectKey: "music" };
const previousFlag = process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS;

beforeEach(() => {
  process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS = "true";
  collection.mockImplementation(() => "enrollments");
  where.mockImplementation((field, op, value) => ({ field, op, value }));
  query.mockImplementation((source, ...constraints) => ({ collection: source, constraints }));
  getDocs.mockResolvedValue({ docs: [] });
});
afterAll(() => {
  if (previousFlag === undefined) delete process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS;
  else process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS = previousFlag;
});

test("includes inactive enrollment histories unless a caller explicitly requests a status", async () => {
  await queryEnrollmentsByScope(scope);
  const constraints = getDocs.mock.calls[0][0].constraints;
  expect(constraints.map((entry) => entry.field)).toEqual(["academicYearKey", "classKey", "subjectKey"]);
  await queryEnrollmentsByScope({ ...scope, status: "active" });
  expect(getDocs.mock.calls[1][0].constraints).toContainEqual({ field: "status", op: "==", value: "active" });
});

test("the production activation gate still prevents scoped reads by default", async () => {
  delete process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS;
  await expect(queryEnrollmentsByScope(scope)).rejects.toThrow(/disabled/);
  expect(getDocs).not.toHaveBeenCalled();
});

test("assignment scope retains yearless and statusless legacy records by default", async () => {
  await queryTeacherAssignmentsByScope({ teacherId: "teacher-1" });
  expect(getDocs.mock.calls[0][0].constraints).toEqual([{ field: "teacherId", op: "==", value: "teacher-1" }]);
  await queryTeacherAssignmentsByScope({ teacherId: "teacher-1", academicYearKey: "2026", status: "active" });
  expect(getDocs.mock.calls[1][0].constraints.map((entry) => entry.field)).toEqual(["teacherId", "academicYearKey", "status"]);
});

test("student-scoped marks reads deduplicate IDs and split requests into Firestore batches", async () => {
  const ids = Array.from({ length: 31 }, (_, index) => `student-${index}`);
  await queryMarksByStudentIds([...ids, ids[0]]);
  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(getDocs.mock.calls[0][0].constraints[0].value).toHaveLength(30);
  expect(getDocs.mock.calls[1][0].constraints[0].value).toEqual([ids[30]]);
});

test("empty student selection makes no marks query and disabled mode rejects it", async () => {
  await expect(queryMarksByStudentIds([])).resolves.toEqual([]);
  expect(getDocs).not.toHaveBeenCalled();
  delete process.env.REACT_APP_ENABLE_CANONICAL_SCOPED_READS;
  await expect(queryMarksByStudentIds(["student-1"])).rejects.toThrow(/disabled/);
});
