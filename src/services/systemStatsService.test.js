import {
  doc,
  getCountFromServer,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  addSystemStatsDeltaToBatch,
  clearSystemStatsSessionCache,
  getSystemStatsOverview,
  rebuildSystemStatsOverview,
} from "./systemStatsService";

jest.mock("../firebase", () => ({
  auth: { currentUser: { uid: "admin-1", email: "admin@example.test" } },
  db: { name: "db" },
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((_db, name) => ({ type: "collection", name })),
  doc: jest.fn((_db, collectionName, documentName) => ({ collectionName, documentName })),
  getCountFromServer: jest.fn(),
  getDoc: jest.fn(),
  increment: jest.fn((value) => ({ increment: value })),
  serverTimestamp: jest.fn(() => ({ serverTimestamp: true })),
  setDoc: jest.fn(),
  writeBatch: jest.fn(),
}));

describe("systemStatsService", () => {
  beforeEach(() => {
    clearSystemStatsSessionCache();
    getCountFromServer.mockReset();
    getDoc.mockReset();
    doc.mockImplementation((_db, collectionName, documentName) => ({ collectionName, documentName }));
    increment.mockImplementation((value) => ({ increment: value }));
    serverTimestamp.mockImplementation(() => ({ serverTimestamp: true }));
    setDoc.mockReset();
  });

  test("reads the overview document once per browser session cache window", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ initialized: true, marksCount: 17861, studentSubjectEnrollmentsCount: 10128 }),
    });

    await expect(getSystemStatsOverview()).resolves.toMatchObject({
      initialized: true,
      marksCount: 17861,
      studentSubjectEnrollmentsCount: 10128,
    });
    await getSystemStatsOverview();
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  test("adds only counter transforms to an existing write batch", () => {
    const batch = { set: jest.fn() };
    expect(addSystemStatsDeltaToBatch(batch, { marks: 3, studentSubjectEnrollments: -2 })).toBe(true);
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: "systemStats", documentName: "overview" }),
      expect.objectContaining({
        marksCount: { increment: 3 },
        studentSubjectEnrollmentsCount: { increment: -2 },
      }),
      { merge: true }
    );
  });

  test("runs full aggregations only when the explicit rebuild function is invoked", async () => {
    getCountFromServer
      .mockResolvedValueOnce({ data: () => ({ count: 17861 }) })
      .mockResolvedValueOnce({ data: () => ({ count: 10128 }) });
    setDoc.mockResolvedValue();

    const result = await rebuildSystemStatsOverview();

    expect(getCountFromServer).toHaveBeenCalledTimes(2);
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: "systemStats", documentName: "overview" }),
      expect.objectContaining({
        initialized: true,
        marksCount: 17861,
        studentSubjectEnrollmentsCount: 10128,
      }),
      { merge: false }
    );
    expect(result).toMatchObject({ marksCount: 17861, studentSubjectEnrollmentsCount: 10128 });
  });
});
