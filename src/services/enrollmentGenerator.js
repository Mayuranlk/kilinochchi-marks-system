import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

/* -------------------- HELPERS -------------------- */

const normalize = (val) => (val || "").toString().trim().toLowerCase();

const buildClassName = (grade, section) => `${grade}${section}`;

/* -------------------- MAIN GENERATOR -------------------- */

export const generateEnrollments = async ({
  grade,
  section,
  academicYear,
}) => {
  try {
    console.log("🚀 Enrollment generation started...");

    /* -------------------- FETCH DATA -------------------- */

    const studentsSnap = await getDocs(
      query(
        collection(db, "students"),
        where("grade", "==", grade),
        where("section", "==", section)
      )
    );

    const subjectsSnap = await getDocs(collection(db, "subjects"));

    const existingSnap = await getDocs(
      query(
        collection(db, "studentSubjectEnrollments"),
        where("grade", "==", grade),
        where("section", "==", section),
        where("academicYear", "==", academicYear)
      )
    );

    /* -------------------- PREPARE MAPS -------------------- */

    const existingSet = new Set();
    existingSnap.forEach((doc) => {
      const d = doc.data();
      existingSet.add(`${d.studentId}_${d.subjectId}`);
    });

    const subjects = subjectsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Group subjects
    const coreSubjects = subjects.filter((s) => s.category === "core");
    const religionSubjects = subjects.filter(
      (s) => s.category === "religion"
    );

    const basketA = subjects.filter(
      (s) => s.category === "basket" && s.subjectCode?.startsWith("B1_")
    );

    const basketB = subjects.filter(
      (s) => s.category === "basket" && s.subjectCode?.startsWith("B2_")
    );

    const basketC = subjects.filter(
      (s) => s.category === "basket" && s.subjectCode?.startsWith("B3_")
    );

    // Fast lookup maps
    const mapByName = (arr) => {
      const map = new Map();
      arr.forEach((s) => {
        map.set(normalize(s.subjectName), s);
      });
      return map;
    };

    const basketAMap = mapByName(basketA);
    const basketBMap = mapByName(basketB);
    const basketCMap = mapByName(basketC);
    const religionMap = mapByName(religionSubjects);

    /* -------------------- PROCESS STUDENTS -------------------- */

    const batch = writeBatch(db);
    let count = 0;

    for (const studentDoc of studentsSnap.docs) {
      const student = { id: studentDoc.id, ...studentDoc.data() };

      const studentId = student.id;
      const className = buildClassName(student.grade, student.section);

      /* -------- CORE SUBJECTS -------- */
      for (const subject of coreSubjects) {
        const key = `${studentId}_${subject.id}`;
        if (existingSet.has(key)) continue;

        batch.set(doc(collection(db, "studentSubjectEnrollments")), {
          studentId,
          subjectId: subject.id,
          subjectName: subject.subjectName,
          grade: student.grade,
          section: student.section,
          className,
          academicYear,
          status: "active",
        });

        count++;
      }

      /* -------- RELIGION -------- */
      const relKey = normalize(student.religion || student.religionChoice);
      const relSubject = religionMap.get(relKey);

      if (relSubject) {
        const key = `${studentId}_${relSubject.id}`;
        if (!existingSet.has(key)) {
          batch.set(doc(collection(db, "studentSubjectEnrollments")), {
            studentId,
            subjectId: relSubject.id,
            subjectName: relSubject.subjectName,
            grade: student.grade,
            section: student.section,
            className,
            academicYear,
            status: "active",
          });
          count++;
        }
      }

      /* -------- BASKET A -------- */
      const aChoice = normalize(
        student.basketAChoice || student.basket1
      );
      const aSubject = basketAMap.get(aChoice);

      if (aSubject) {
        const key = `${studentId}_${aSubject.id}`;
        if (!existingSet.has(key)) {
          batch.set(doc(collection(db, "studentSubjectEnrollments")), {
            studentId,
            subjectId: aSubject.id,
            subjectName: aSubject.subjectName,
            grade: student.grade,
            section: student.section,
            className,
            academicYear,
            status: "active",
          });
          count++;
        }
      }

      /* -------- BASKET B (FIXED ISSUE) -------- */
      const bChoice = normalize(
        student.basketBChoice || student.basket2
      );

      const bSubject = basketBMap.get(bChoice);

      if (bSubject) {
        const key = `${studentId}_${bSubject.id}`;
        if (!existingSet.has(key)) {
          batch.set(doc(collection(db, "studentSubjectEnrollments")), {
            studentId,
            subjectId: bSubject.id,
            subjectName: bSubject.subjectName,
            grade: student.grade,
            section: student.section,
            className,
            academicYear,
            status: "active",
          });
          count++;
        }
      } else {
        console.warn(
          `❌ Basket B not matched for student ${studentId}:`,
          student.basketBChoice
        );
      }

      /* -------- BASKET C -------- */
      const cChoice = normalize(
        student.basketCChoice || student.basket3
      );
      const cSubject = basketCMap.get(cChoice);

      if (cSubject) {
        const key = `${studentId}_${cSubject.id}`;
        if (!existingSet.has(key)) {
          batch.set(doc(collection(db, "studentSubjectEnrollments")), {
            studentId,
            subjectId: cSubject.id,
            subjectName: cSubject.subjectName,
            grade: student.grade,
            section: student.section,
            className,
            academicYear,
            status: "active",
          });
          count++;
        }
      }
    }

    /* -------------------- COMMIT -------------------- */

    await batch.commit();

    console.log(`✅ Enrollments created: ${count}`);

    return {
      success: true,
      message: `${count} enrollments generated successfully`,
    };
  } catch (error) {
    console.error("❌ Enrollment generation failed:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};