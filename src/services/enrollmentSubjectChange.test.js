import { saveStudentSubjectTermChange } from "./enrollmentGenerator";
import { collection, doc, getDocs, query, runTransaction, serverTimestamp } from "firebase/firestore";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("./firestoreReadCache", () => ({ invalidateCollectionRows: jest.fn() }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((_db, name) => ({ name })),
  doc: jest.fn((_db, name, id) => ({ name, id })),
  query: jest.fn((ref) => ref),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => "timestamp"),
  getDocs: jest.fn(),
  runTransaction: jest.fn(),
  writeBatch: jest.fn(),
}));

const student = { id: "s1", name: "Student", grade: 6, section: "A", aesthetic: "Art", aestheticChoice: "Art", status: "Active" };
const art = { id: "art", name: "Art", category: "aesthetic", grade: 6 };
const music = { id: "music", name: "Music", category: "aesthetic", grade: 6 };
const enrollment = { id: "old", studentId: "s1", subjectId: "art", subjectName: "Art", academicYear: "2026", status: "active" };
const terms = [1, 2, 3].map((n) => ({ id: `t${n}`, term: `Term ${n}` }));
const snapshot = (rows) => ({ docs: rows.map(({ id, ...data }) => ({ id, data: () => data })) });
const args = { academicYear: "2026", studentId: "s1", studentPayload: { aesthetic: "Music", aestheticChoice: "Music" }, terms, termIds: ["t1", "t2", "t3"], effectiveTermId: "t3", confirmedOldTermIds: ["t1", "t2"] };

beforeEach(() => {
  collection.mockImplementation((_db, name) => ({ name }));
  doc.mockImplementation((_db, name, id) => ({ name, id }));
  query.mockImplementation((ref) => ref);
  serverTimestamp.mockReturnValue("timestamp");
  getDocs.mockReset();
  runTransaction.mockReset();
  getDocs.mockImplementation(async ({ name }) => snapshot(({ students: [student], subjects: [art, music], studentSubjectEnrollments: [enrollment], marks: [] })[name] || []));
});

test("saves the student and both enrollment histories together", async () => {
  const writes = [];
  runTransaction.mockImplementation(async (_db, callback) => callback({
    get: async (ref) => {
      const data = ref.name === "students" ? student : ref.id === "old" ? enrollment : null;
      return { exists: () => !!data, data: () => data };
    },
    update: (ref, value) => writes.push({ ref, value }),
    set: (ref, value) => writes.push({ ref, value }),
  }));
  await saveStudentSubjectTermChange(args);
  expect(writes).toHaveLength(3);
  expect(writes.find((write) => write.ref.id === "old").value).toMatchObject({ status: "inactive", subjectTermIds: ["t1", "t2"] });
  expect(writes.find((write) => write.ref.id === "2026_s1_music").value).toMatchObject({ status: "active", subjectTermIds: ["t3"] });
});

test("rejects conflicting historical marks before attempting a transaction", async () => {
  getDocs.mockImplementation(async ({ name }) => snapshot(({ students: [student], subjects: [art, music], studentSubjectEnrollments: [enrollment], marks: [{ id: "m1", studentId: "s1", subjectId: "art", academicYear: "2026", term: "Term 2" }] })[name] || []));
  await expect(saveStudentSubjectTermChange({ ...args, confirmedOldTermIds: ["t1"] })).rejects.toThrow(/marks conflict/);
  expect(runTransaction).not.toHaveBeenCalled();
});
