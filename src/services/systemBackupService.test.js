import { GeoPoint, Timestamp } from "firebase/firestore";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  deserializeFirestoreValue,
  serializeFirestoreValue,
  validateSystemBackup,
} from "./systemBackupService";

const makeBackup = (overrides = {}) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  projectId: "kilinochchi-marks",
  createdAt: "2026-07-29T08:00:00.000Z",
  collections: {
    students: [{ id: "student-1", data: { name: "Student One" } }],
  },
  ...overrides,
});

describe("system backup validation", () => {
  test("accepts a valid versioned backup and counts documents", () => {
    const result = validateSystemBackup(makeBackup(), "kilinochchi-marks");

    expect(result).toEqual({
      collectionCount: 1,
      documentCount: 1,
      counts: { students: 1 },
    });
  });

  test("rejects a backup from another Firebase project", () => {
    expect(() => validateSystemBackup(makeBackup(), "another-project")).toThrow(
      "different Firebase project"
    );
  });

  test("rejects unknown collections and unsafe document IDs", () => {
    expect(() =>
      validateSystemBackup(
        makeBackup({ collections: { unexpectedData: [] } }),
        "kilinochchi-marks"
      )
    ).toThrow("Unknown collection");

    expect(() =>
      validateSystemBackup(
        makeBackup({ collections: { students: [{ id: "folder/student-1", data: {} }] } }),
        "kilinochchi-marks"
      )
    ).toThrow("invalid document ID");
  });
});

describe("Firestore value preservation", () => {
  test("round-trips timestamps and geographic points", () => {
    const original = {
      createdAt: new Timestamp(1_700_000_000, 123_000_000),
      location: new GeoPoint(9.3803, 80.377),
      nested: [{ reviewedAt: new Timestamp(1_710_000_000, 0) }],
    };

    const restored = deserializeFirestoreValue(serializeFirestoreValue(original));

    expect(restored.createdAt).toBeInstanceOf(Timestamp);
    expect(restored.createdAt.seconds).toBe(original.createdAt.seconds);
    expect(restored.createdAt.nanoseconds).toBe(original.createdAt.nanoseconds);
    expect(restored.location).toBeInstanceOf(GeoPoint);
    expect(restored.location.latitude).toBeCloseTo(9.3803);
    expect(restored.nested[0].reviewedAt.seconds).toBe(1_710_000_000);
  });
});
