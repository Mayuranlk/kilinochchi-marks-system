import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../firebase";
import { getScopedRows, recordRead } from "./firestoreReadCache";

// Temporary compatibility path for legacy statistics. Never perform unbounded
// school-wide reads merely to decorate the teacher landing page.
const MAX_PROGRESS_DOCUMENTS = 1000;
export async function loadTeacherProgress(options = {}) {
  const result = {};
  for (const [key, name] of [["enrollments", "studentSubjectEnrollments"], ["marks", "marks"]]) {
    result[key] = await getScopedRows(name, ["bounded-teacher-progress"], async () => {
      const snapshot = await getDocs(query(collection(db, name), limit(MAX_PROGRESS_DOCUMENTS + 1)));
      if (snapshot.docs.length > MAX_PROGRESS_DOCUMENTS) {
        recordRead(`${name}: progress limit reached`, snapshot.docs.length);
        throw new Error("Term statistics are too large to load safely here. SBA and marks entry remain available.");
      }
      return snapshot;
    }, options);
  }
  return result;
}
