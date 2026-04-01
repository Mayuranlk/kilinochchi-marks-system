import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../firebase";

const collectionsToExport = [
  "users",
  "students",
  "subjects",
  "classrooms",
  "studentSubjectEnrollments",
  "teacherAssignments",
  "marks",
  "academicTerms",
  "promotionHistory",
];

function safeSortDocs(rows) {
  return [...rows].sort((a, b) => {
    const aName = String(a.name || a.fullName || a.subjectName || a.term || a.id || "");
    const bName = String(b.name || b.fullName || b.subjectName || b.term || b.id || "");
    return aName.localeCompare(bName);
  });
}

export const exportFirestoreSamples = async () => {
  const result = {
    exportedAt: new Date().toISOString(),
    collections: {},
  };

  for (const collectionName of collectionsToExport) {
    try {
      const q = query(collection(db, collectionName), limit(20));
      const snap = await getDocs(q);

      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      result.collections[collectionName] = safeSortDocs(rows);
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
  a.download = "kilinochchi-marks-firestore-samples.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};