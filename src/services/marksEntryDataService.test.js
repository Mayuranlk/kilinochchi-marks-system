import { getDocs } from "firebase/firestore";
import { clearFirestoreReadCache } from "./firestoreReadCache";
import { loadMarksForStudents } from "./marksEntryDataService";

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

test("term entry reads only selected students, year and subject", async () => {
  getDocs.mockResolvedValue(snapshot([{ id: "m1", studentId: "s1", mark: 55 }]));

  const rows = await loadMarksForStudents(
    ["s2", "s1", "s1"],
    { academicYear: "2026", subjectId: "maths" }
  );

  expect(rows).toEqual([{ id: "m1", studentId: "s1", mark: 55 }]);
  expect(getDocs).toHaveBeenCalledTimes(1);
  getDocs.mock.calls.forEach(([request]) => {
    expect(request[0]).toBe("marks");
    expect(request).toContainEqual(["studentId", "in", ["s1", "s2"]]);
    expect(request).toContainEqual(["subjectId", "==", "maths"]);
    expect(request.some((part) => ["academicYear", "year"].includes(part[0]))).toBe(true);
    expect(request).toContainEqual(["limit", 2501]);
  });
});

test("large rosters are split at the Firestore in-query limit", async () => {
  getDocs.mockResolvedValue(snapshot());
  const ids = Array.from({ length: 31 }, (_, index) => `s${String(index).padStart(2, "0")}`);

  await loadMarksForStudents(ids);

  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(getDocs.mock.calls[0][0]).toContainEqual(["studentId", "in", ids.slice(0, 30)]);
  expect(getDocs.mock.calls[1][0]).toContainEqual(["studentId", "in", ids.slice(30)]);
});

test("a missing merged index falls back to bounded student history", async () => {
  let requestNumber = 0;
  getDocs.mockImplementation(() => {
    requestNumber += 1;
    if (requestNumber === 1) {
      return Promise.reject(Object.assign(new Error("index"), { code: "failed-precondition" }));
    }
    if (requestNumber === 2) {
      return Promise.resolve(snapshot([{ id: "legacy", studentId: "s1" }]));
    }
    return Promise.resolve(snapshot());
  });

  await expect(
    loadMarksForStudents(["s1"], { academicYear: "2026", subjectId: "maths" })
  ).resolves.toEqual([{ id: "legacy", studentId: "s1" }]);

  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(getDocs.mock.calls[1][0]).toEqual([
    "marks",
    ["studentId", "in", ["s1"]],
    ["limit", 2501],
  ]);
});

test("empty roster performs no reads", async () => {
  await expect(loadMarksForStudents([])).resolves.toEqual([]);
  expect(getDocs).not.toHaveBeenCalled();
});