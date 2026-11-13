import { getDocs } from "firebase/firestore";
import { clearFirestoreReadCache } from "./firestoreReadCache";
import { loadRowsForAcademicYear, loadRowsForGrades, loadRowsWhereIn } from "./firestoreScopedReads";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: (_db, name) => name,
  getDocs: jest.fn(),
  limit: (value) => ["limit", value],
  query: (...parts) => parts,
  where: (...parts) => parts,
}));

const snapshot = (rows = []) => ({
  docs: rows.map(({ id, ...data }) => ({ id, data: () => data })),
});

beforeEach(() => {
  clearFirestoreReadCache();
  getDocs.mockReset();
});

test("grade scopes replace full collection scans", async () => {
  getDocs
    .mockResolvedValueOnce(snapshot([{ id: "numeric", grade: 10 }]))
    .mockResolvedValueOnce(snapshot([{ id: "string", grade: "10" }, { id: "numeric", grade: 10 }]));

  await expect(loadRowsForGrades("students", [10])).resolves.toEqual([
    { id: "numeric", grade: 10 },
    { id: "string", grade: "10" },
  ]);
  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(getDocs.mock.calls[0][0]).toContainEqual(["grade", "in", [10]]);
  expect(getDocs.mock.calls[1][0]).toContainEqual(["grade", "in", ["10"]]);
});

test("empty scopes never read and large in lists are chunked", async () => {
  await expect(loadRowsWhereIn("marks", "grade", [])).resolves.toEqual([]);
  expect(getDocs).not.toHaveBeenCalled();

  getDocs.mockResolvedValue(snapshot());
  const grades = Array.from({ length: 31 }, (_, index) => index + 1);
  await loadRowsWhereIn("marks", "grade", grades);
  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(getDocs.mock.calls[0][0]).toContainEqual(["limit", 5001]);
});
test("academic-year scope stops after the primary legacy field succeeds", async () => {
  getDocs.mockResolvedValue(snapshot([{ id: "m1", academicYear: "2026" }]));
  await expect(loadRowsForAcademicYear("marks", "2026")).resolves.toEqual([
    { id: "m1", academicYear: "2026" },
  ]);
  expect(getDocs).toHaveBeenCalledTimes(1);
  expect(getDocs.mock.calls[0][0]).toContainEqual(["academicYear", "==", "2026"]);
  expect(getDocs.mock.calls[0][0]).toContainEqual(["limit", 20001]);
});
