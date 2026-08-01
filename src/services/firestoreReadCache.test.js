import { getCountFromServer, getDocs } from "firebase/firestore";
import {
  clearFirestoreReadCache,
  getCollectionCount,
  getCollectionRows,
  invalidateCollectionRows,
  updateCachedCollection,
} from "./firestoreReadCache";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((_db, name) => ({ name })),
  getCountFromServer: jest.fn(),
  getDocs: jest.fn(),
}));

function snapshot(rows) {
  return {
    docs: rows.map(({ id, ...data }) => ({ id, data: () => data })),
  };
}

describe("firestoreReadCache", () => {
  beforeEach(() => {
    clearFirestoreReadCache();
    getDocs.mockReset();
    getCountFromServer.mockReset();
  });

  test("deduplicates concurrent collection reads and reuses the result", async () => {
    getDocs.mockResolvedValue(snapshot([{ id: "s1", name: "Student" }]));

    const first = getCollectionRows({}, "students");
    const second = getCollectionRows({}, "students");
    const [firstRows, secondRows] = await Promise.all([first, second]);

    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(firstRows).toEqual([{ id: "s1", name: "Student" }]);
    expect(secondRows).toBe(firstRows);
    await getCollectionRows({}, "students");
    expect(getDocs).toHaveBeenCalledTimes(1);
  });

  test("supports explicit refreshes and local write-through updates", async () => {
    getDocs
      .mockResolvedValueOnce(snapshot([{ id: "m1", mark: 50 }]))
      .mockResolvedValueOnce(snapshot([{ id: "m1", mark: 60 }]));

    await getCollectionRows({}, "marks");
    updateCachedCollection("marks", (rows) =>
      rows.map((row) => (row.id === "m1" ? { ...row, mark: 55 } : row))
    );
    expect(await getCollectionRows({}, "marks")).toEqual([{ id: "m1", mark: 55 }]);
    expect(await getCollectionRows({}, "marks", { forceRefresh: true })).toEqual([
      { id: "m1", mark: 60 },
    ]);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  test("deduplicates concurrent forced refreshes", async () => {
    let resolveRead;
    getDocs.mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      })
    );

    const first = getCollectionRows({}, "students", { forceRefresh: true });
    const second = getCollectionRows({}, "students", { forceRefresh: true });
    expect(getDocs).toHaveBeenCalledTimes(1);

    resolveRead(snapshot([{ id: "s1" }]));
    await expect(first).resolves.toEqual([{ id: "s1" }]);
    await expect(second).resolves.toEqual([{ id: "s1" }]);
  });

  test("an invalidated in-flight read cannot repopulate stale cache", async () => {
    let resolveOldRead;
    getDocs
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOldRead = resolve;
        })
      )
      .mockResolvedValueOnce(snapshot([{ id: "new" }]));

    const oldRead = getCollectionRows({}, "marks");
    invalidateCollectionRows("marks");
    const newRead = getCollectionRows({}, "marks");

    resolveOldRead(snapshot([{ id: "old" }]));
    await oldRead;
    await expect(newRead).resolves.toEqual([{ id: "new" }]);
    await expect(getCollectionRows({}, "marks")).resolves.toEqual([{ id: "new" }]);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  test("uses aggregation counts when supported", async () => {
    getCountFromServer.mockResolvedValue({ data: () => ({ count: 42 }) });

    expect(await getCollectionCount({}, "marks")).toBe(42);
    expect(await getCollectionCount({}, "marks")).toBe(42);
    expect(getCountFromServer).toHaveBeenCalledTimes(1);
    expect(getDocs).not.toHaveBeenCalled();
  });

  test("falls back to a compatible collection read when aggregation is denied", async () => {
    getCountFromServer.mockRejectedValue(new Error("permission-denied"));
    getDocs.mockResolvedValue(snapshot([{ id: "s1" }, { id: "s2" }]));
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(await getCollectionCount({}, "students")).toBe(2);
    expect(getDocs).toHaveBeenCalledTimes(1);
    warning.mockRestore();
  });
});
