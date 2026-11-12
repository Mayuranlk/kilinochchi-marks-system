import { getDocs } from "firebase/firestore";
import { clearFirestoreReadCache } from "./firestoreReadCache";
import { loadTeacherProgress } from "./teacherProgressService";
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ collection: (_db, name) => name, query: (...args) => args, limit: (n) => ({ limit: n }), getDocs: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); clearFirestoreReadCache(); });
test("caps progress requests and rejects truncated statistics without reading marks", async () => {
  getDocs.mockResolvedValue({ docs: Array.from({ length: 1001 }, () => ({})) });
  await expect(loadTeacherProgress()).rejects.toThrow("too large");
  expect(getDocs).toHaveBeenCalledTimes(1);
  expect(getDocs).toHaveBeenCalledWith(["studentSubjectEnrollments", { limit: 1001 }]);
});
test("complete small statistics are reused without another download", async () => {
  getDocs.mockResolvedValue({ docs: [{ id: "one", data: () => ({}) }] });
  expect(await loadTeacherProgress()).toEqual({ enrollments: [{ id: "one" }], marks: [{ id: "one" }] });
  await loadTeacherProgress();
  expect(getDocs).toHaveBeenCalledTimes(2);
});
