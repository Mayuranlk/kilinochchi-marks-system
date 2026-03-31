import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../firebase";

const collectionsToExport = [
  "users",
  "students",
  "subjects",
  "studentSubjectEnrollments",
  "marks",
  "academicTerms",
  "terms",
  "teacherAssignments",
];

export const exportFirestoreSamples = async () => {
  const result = {
    exportedAt: new Date().toISOString(),
    collections: {},
  };

  for (const collectionName of collectionsToExport) {
    try {
      const q = query(collection(db, collectionName), limit(20));
      const snap = await getDocs(q);

      result.collections[collectionName] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    } catch (error) {
      result.collections[collectionName] = {
        error: error.message,
      };
    }
  }

  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "firestore-samples.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};