import { getCountFromServer, getDocs } from "firebase/firestore";
import {
  clearFirestoreReadCache,
  getCollectionCount,
  getCollectionRows,
  getScopedRows,
  getReadDiagnostics,
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

  test("deduplicates concurrent aggregation counts including forced refreshes", async () => {
    let resolveCount;
    getCountFromServer.mockReturnValue(
      new Promise((resolve) => {
        resolveCount = resolve;
      })
    );

    const first = getCollectionCount({}, "marks", { forceRefresh: true });
    const second = getCollectionCount({}, "marks", { forceRefresh: true });
    expect(getCountFromServer).toHaveBeenCalledTimes(1);

    resolveCount({ data: () => ({ count: 42 }) });
    await expect(first).resolves.toBe(42);
    await expect(second).resolves.toBe(42);
  });

  test("an invalidated in-flight aggregation cannot repopulate stale count cache", async () => {
    let resolveOldCount;
    getCountFromServer
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOldCount = resolve;
        })
      )
      .mockResolvedValueOnce({ data: () => ({ count: 2 }) });

    const oldCount = getCollectionCount({}, "marks");
    invalidateCollectionRows("marks");
    const newCount = getCollectionCount({}, "marks");

    resolveOldCount({ data: () => ({ count: 99 }) });
    await expect(oldCount).resolves.toBe(99);
    await expect(newCount).resolves.toBe(2);
    await expect(getCollectionCount({}, "marks")).resolves.toBe(2);
    expect(getCountFromServer).toHaveBeenCalledTimes(2);
  });

  test("aggregation failure never scans a collection", async () => {
    getCountFromServer.mockRejectedValue(new Error("permission-denied"));
    await expect(getCollectionCount({}, "marks")).rejects.toThrow("permission-denied");
    expect(getDocs).not.toHaveBeenCalled();
  });
  test("scoped queries deduplicate and honor refresh, writes and sign out", async () => {
    const read = jest.fn(async () => snapshot([{ id: "a" }]));
    await Promise.all([getScopedRows("students", ["a"], read), getScopedRows("students", ["a"], read)]);
    await getScopedRows("students", ["a"], read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(getReadDiagnostics().at(-1).cached).toBe(true);
    await getScopedRows("students", ["a"], read, { forceRefresh: true });
    invalidateCollectionRows("students");
    await getScopedRows("students", ["a"], read);
    clearFirestoreReadCache();
    await getScopedRows("students", ["a"], read);
    expect(read).toHaveBeenCalledTimes(4);
  });
  test("invalidated in-flight scoped queries cannot restore stale rows", async () => {
    let resolve;
    const old = getScopedRows("students", ["a"], () => new Promise((done) => { resolve = done; }));
    invalidateCollectionRows("students");
    const read = jest.fn(async () => snapshot([{ id: "new" }]));
    await getScopedRows("students", ["a"], read);
    resolve(snapshot([{ id: "old" }]));
    await old;
    expect(await getScopedRows("students", ["a"], read)).toEqual([{ id: "new" }]);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
