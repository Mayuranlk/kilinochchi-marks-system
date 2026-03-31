// src/services/enrollmentGenerator.js

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

const STUDENTS_COLLECTION = "students";
const SUBJECTS_COLLECTION = "subjects";
const ENROLLMENTS_COLLECTION = "studentSubjectEnrollments";

const BATCH_LIMIT = 400;

export const ENROLLMENT_MODES = {
  GENERATE_MISSING: "generate_missing",
  REGENERATE_STUDENT: "regenerate_student",
  FULL_REBUILD: "full_rebuild",
};

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeLoose(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function parseGrade(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isStudentActive(student) {
  if (typeof student?.isActive === "boolean") return student.isActive;
  if (student?.status) return normalize(student.status) === "active";
  return true;
}

function isSubjectActive(subject) {
  if (typeof subject?.isActive === "boolean") return subject.isActive;
  if (subject?.status) return normalize(subject.status) === "active";
  return true;
}

function isALStudent(student) {
  const grade = parseGrade(student?.grade);
  return grade >= 12 || !!student?.stream;
}

function uniqueEnrollmentId(studentId, subjectId, academicYear) {
  return `${academicYear}_${studentId}_${subjectId}`;
}

function tokenSet(values) {
  const set = new Set();

  toArray(values).forEach((value) => {
    if (value === null || value === undefined) return;

    if (typeof value === "object" && !Array.isArray(value)) {
      Object.values(value).forEach((v) => {
        if (!v) return;
        set.add(normalize(v));
        set.add(normalizeLoose(v));
      });
      return;
    }

    set.add(normalize(value));
    set.add(normalizeLoose(value));
  });

  return set;
}

function subjectTokens(subject) {
  const set = new Set();
  [
    subject?.id,
    subject?.code,
    subject?.subjectCode,
    subject?.name,
    subject?.subjectName,
    subject?.shortName,
  ]
    .filter(Boolean)
    .forEach((v) => {
      set.add(normalize(v));
      set.add(normalizeLoose(v));
    });

  return set;
}

function subjectMatchesChoice(subject, choice) {
  const choiceTokens = tokenSet(choice);
  const sTokens = subjectTokens(subject);

  for (const token of choiceTokens) {
    if (sTokens.has(token)) return true;
  }
  return false;
}

function valueMatches(subjectValue, studentValue) {
  const a = tokenSet(subjectValue);
  const b = tokenSet(studentValue);

  for (const token of a) {
    if (b.has(token)) return true;
  }
  return false;
}

function subjectAppliesToGrade(subject, grade) {
  if (!grade) return false;

  const directGrade = parseGrade(subject?.grade);
  if (directGrade !== null) return directGrade === grade;

  const grades = toArray(subject?.grades).map(parseGrade).filter((v) => v !== null);
  if (grades.length) return grades.includes(grade);

  const applicableGrades = toArray(subject?.applicableGrades)
    .map(parseGrade)
    .filter((v) => v !== null);
  if (applicableGrades.length) return applicableGrades.includes(grade);

  const minGrade = parseGrade(subject?.minGrade);
  const maxGrade = parseGrade(subject?.maxGrade);

  if (minGrade !== null || maxGrade !== null) {
    const min = minGrade ?? -Infinity;
    const max = maxGrade ?? Infinity;
    return grade >= min && grade <= max;
  }

  return true;
}

function buildSubjectIndex(subjects) {
  const activeSubjects = subjects.filter(isSubjectActive);

  return {
    all: activeSubjects,
    core: activeSubjects.filter((s) => normalize(s.category) === "core"),
    religion: activeSubjects.filter((s) => normalize(s.category) === "religion"),
    aesthetic: activeSubjects.filter((s) => normalize(s.category) === "aesthetic"),
    basketA: activeSubjects.filter((s) => normalize(s.category) === "basket_a"),
    basketB: activeSubjects.filter((s) => normalize(s.category) === "basket_b"),
    basketC: activeSubjects.filter((s) => normalize(s.category) === "basket_c"),
    alMain: activeSubjects.filter((s) => normalize(s.category) === "al_main"),
  };
}

function validateStudent(student, subjectIndex) {
  const errors = [];
  const grade = parseGrade(student?.grade);

  if (!grade) errors.push("Missing grade");
  if (!student?.className) errors.push("Missing className");

  if (!grade) return errors;

  const isAL = isALStudent(student);

  const religionSubjects = subjectIndex.religion.filter((s) => subjectAppliesToGrade(s, grade));
  if (religionSubjects.length && !student?.religion) {
    errors.push("Missing religion");
  }

  const aestheticSubjects = subjectIndex.aesthetic.filter((s) => subjectAppliesToGrade(s, grade));
  if (!isAL && aestheticSubjects.length && !student?.aestheticChoice) {
    errors.push("Missing aestheticChoice");
  }

  if (!isAL && (grade === 10 || grade === 11)) {
    if (subjectIndex.basketA.some((s) => subjectAppliesToGrade(s, grade)) && !student?.basketA) {
      errors.push("Missing basketA");
    }
    if (subjectIndex.basketB.some((s) => subjectAppliesToGrade(s, grade)) && !student?.basketB) {
      errors.push("Missing basketB");
    }
    if (subjectIndex.basketC.some((s) => subjectAppliesToGrade(s, grade)) && !student?.basketC) {
      errors.push("Missing basketC");
    }
  }

  if (isAL) {
    if (!student?.stream) errors.push("Missing stream");
    if (!toArray(student?.alSubjectChoices).length) {
      errors.push("Missing alSubjectChoices");
    }
  }

  return errors;
}

function buildDesiredSubjects(student, subjectIndex) {
  const grade = parseGrade(student?.grade);
  const issues = validateStudent(student, subjectIndex);

  if (issues.length) {
    return { subjects: [], issues };
  }

  const desired = new Map();
  const isAL = isALStudent(student);

  const add = (subject) => {
    if (subject?.id) desired.set(subject.id, subject);
  };

  subjectIndex.core
    .filter((s) => subjectAppliesToGrade(s, grade))
    .forEach(add);

  subjectIndex.religion
    .filter((s) => subjectAppliesToGrade(s, grade))
    .filter(
      (s) =>
        valueMatches(s?.religion, student?.religion) ||
        valueMatches(s?.religionGroup, student?.religion) ||
        valueMatches(s?.name, student?.religion)
    )
    .forEach(add);

  if (!isAL) {
    subjectIndex.aesthetic
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => subjectMatchesChoice(s, student?.aestheticChoice))
      .forEach(add);

    subjectIndex.basketA
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => subjectMatchesChoice(s, student?.basketA))
      .forEach(add);

    subjectIndex.basketB
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => subjectMatchesChoice(s, student?.basketB))
      .forEach(add);

    subjectIndex.basketC
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => subjectMatchesChoice(s, student?.basketC))
      .forEach(add);
  }

  if (isAL) {
    subjectIndex.alMain
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => {
        const streamOk =
          !s?.stream && !s?.streams
            ? true
            : valueMatches(s?.stream, student?.stream) ||
              valueMatches(s?.streams, student?.stream);

        const choiceOk = subjectMatchesChoice(s, student?.alSubjectChoices);
        return streamOk && choiceOk;
      })
      .forEach(add);
  }

  if (!desired.size) {
    return { subjects: [], issues: ["No matching subjects found"] };
  }

  return { subjects: Array.from(desired.values()), issues: [] };
}

function enrollmentPayload(student, subject, academicYear) {
  const gradeNumber = parseGrade(student.grade);
  const className = student.className || student.section || "";

  return {
    studentId: student.id,
    studentName: student.fullName || student.name || "",
    admissionNo: student.admissionNo || student.indexNumber || "",
    subjectId: subject.id,
    subjectName: subject.name || subject.subjectName || "",
    grade: gradeNumber || null,
    section: className,
    className,
    academicYear,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function mapDocs(snapshot) {
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

async function fetchStudents() {
  const snap = await getDocs(collection(db, STUDENTS_COLLECTION));
  return mapDocs(snap);
}

async function fetchSubjects() {
  const snap = await getDocs(collection(db, SUBJECTS_COLLECTION));
  return mapDocs(snap);
}

async function fetchEnrollmentsByYear(academicYear) {
  const q = query(
    collection(db, ENROLLMENTS_COLLECTION),
    where("academicYear", "==", academicYear)
  );
  const snap = await getDocs(q);
  return mapDocs(snap);
}

async function fetchEnrollmentsByStudent(academicYear, studentId) {
  const q = query(
    collection(db, ENROLLMENTS_COLLECTION),
    where("academicYear", "==", academicYear),
    where("studentId", "==", studentId)
  );
  const snap = await getDocs(q);
  return mapDocs(snap);
}

function groupEnrollmentsByStudent(enrollments) {
  const map = new Map();
  for (const enrollment of enrollments) {
    if (!map.has(enrollment.studentId)) {
      map.set(enrollment.studentId, []);
    }
    map.get(enrollment.studentId).push(enrollment);
  }
  return map;
}

async function commitOperations(operations) {
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + BATCH_LIMIT);
    chunk.forEach((fn) => fn(batch));
    await batch.commit();
  }
}

export async function generateMissingEnrollments({ academicYear }) {
  const [students, subjects, enrollments] = await Promise.all([
    fetchStudents(),
    fetchSubjects(),
    fetchEnrollmentsByYear(academicYear),
  ]);

  const subjectIndex = buildSubjectIndex(subjects);
  const activeStudents = students.filter(isStudentActive);
  const enrollmentMap = groupEnrollmentsByStudent(enrollments);

  const operations = [];
  const logs = [];

  let totalProcessed = 0;
  let created = 0;
  let reactivated = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const student of activeStudents) {
    totalProcessed += 1;

    try {
      const { subjects: desiredSubjects, issues } = buildDesiredSubjects(student, subjectIndex);

      if (issues.length) {
        skipped += 1;
        logs.push({
          type: "warning",
          message: `${student.fullName || student.name || student.id} skipped`,
          details: issues.join(", "),
        });
        continue;
      }

      const existing = enrollmentMap.get(student.id) || [];
      const existingBySubjectId = new Map(existing.map((e) => [e.subjectId, e]));

      for (const subject of desiredSubjects) {
        const existingEnrollment = existingBySubjectId.get(subject.id);
        const ref = doc(
          db,
          ENROLLMENTS_COLLECTION,
          uniqueEnrollmentId(student.id, subject.id, academicYear)
        );
        const payload = enrollmentPayload(student, subject, academicYear);

        if (!existingEnrollment) {
          created += 1;
          operations.push((batch) => batch.set(ref, payload, { merge: true }));
          continue;
        }

        if (existingEnrollment.status === "inactive") {
          reactivated += 1;
          operations.push((batch) => batch.set(ref, payload, { merge: true }));
          continue;
        }

        const changed =
          existingEnrollment.subjectName !== payload.subjectName ||
          existingEnrollment.grade !== payload.grade ||
          existingEnrollment.className !== payload.className ||
          existingEnrollment.status !== "active";

        if (changed) {
          updated += 1;
          operations.push((batch) => batch.set(ref, payload, { merge: true }));
        }
      }
    } catch (error) {
      errors += 1;
      logs.push({
        type: "error",
        message: `${student.fullName || student.name || student.id} failed`,
        details: error.message,
      });
    }
  }

  await commitOperations(operations);

  return {
    mode: ENROLLMENT_MODES.GENERATE_MISSING,
    totalProcessed,
    created,
    reactivated,
    updated,
    deactivated: 0,
    skipped,
    errors,
    logs,
  };
}

export async function regenerateSingleStudent({ academicYear, studentId }) {
  const [students, subjects, existingEnrollments] = await Promise.all([
    fetchStudents(),
    fetchSubjects(),
    fetchEnrollmentsByStudent(academicYear, studentId),
  ]);

  const student = students.find((s) => s.id === studentId);

  if (!student) {
    throw new Error("Student not found.");
  }

  if (!isStudentActive(student)) {
    return {
      mode: ENROLLMENT_MODES.REGENERATE_STUDENT,
      totalProcessed: 1,
      created: 0,
      reactivated: 0,
      updated: 0,
      deactivated: 0,
      skipped: 1,
      errors: 0,
      logs: [
        {
          type: "warning",
          message: `${student.fullName || student.name || student.id} skipped`,
          details: "Student is inactive",
        },
      ],
    };
  }

  const subjectIndex = buildSubjectIndex(subjects);
  const { subjects: desiredSubjects, issues } = buildDesiredSubjects(student, subjectIndex);

  if (issues.length) {
    return {
      mode: ENROLLMENT_MODES.REGENERATE_STUDENT,
      totalProcessed: 1,
      created: 0,
      reactivated: 0,
      updated: 0,
      deactivated: 0,
      skipped: 1,
      errors: 0,
      logs: [
        {
          type: "warning",
          message: `${student.fullName || student.name || student.id} skipped`,
          details: issues.join(", "),
        },
      ],
    };
  }

  const operations = [];
  let created = 0;
  let reactivated = 0;
  let updated = 0;
  let deactivated = 0;

  for (const enrollment of existingEnrollments) {
    if (enrollment.status !== "inactive") {
      const ref = doc(db, ENROLLMENTS_COLLECTION, enrollment.id);
      deactivated += 1;
      operations.push((batch) =>
        batch.set(
          ref,
          {
            status: "inactive",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    }
  }

  for (const subject of desiredSubjects) {
    const existing = existingEnrollments.find((e) => e.subjectId === subject.id);
    const ref = doc(
      db,
      ENROLLMENTS_COLLECTION,
      uniqueEnrollmentId(student.id, subject.id, academicYear)
    );
    const payload = enrollmentPayload(student, subject, academicYear);

    if (!existing) created += 1;
    else if (existing.status === "inactive") reactivated += 1;
    else updated += 1;

    operations.push((batch) => batch.set(ref, payload, { merge: true }));
  }

  await commitOperations(operations);

  return {
    mode: ENROLLMENT_MODES.REGENERATE_STUDENT,
    totalProcessed: 1,
    created,
    reactivated,
    updated,
    deactivated,
    skipped: 0,
    errors: 0,
    logs: [
      {
        type: "success",
        message: `${student.fullName || student.name || student.id} regenerated`,
        details: `Subjects rebuilt: ${desiredSubjects.length}`,
      },
    ],
  };
}

export async function fullRebuildEnrollments({ academicYear }) {
  const [students, subjects, enrollments] = await Promise.all([
    fetchStudents(),
    fetchSubjects(),
    fetchEnrollmentsByYear(academicYear),
  ]);

  const subjectIndex = buildSubjectIndex(subjects);
  const activeStudents = students.filter(isStudentActive);
  const enrollmentMap = groupEnrollmentsByStudent(enrollments);

  const operations = [];
  const logs = [];

  let totalProcessed = 0;
  let created = 0;
  let reactivated = 0;
  let updated = 0;
  let deactivated = 0;
  let skipped = 0;
  let errors = 0;

  for (const enrollment of enrollments) {
    if (enrollment.status !== "inactive") {
      const ref = doc(db, ENROLLMENTS_COLLECTION, enrollment.id);
      deactivated += 1;
      operations.push((batch) =>
        batch.set(
          ref,
          {
            status: "inactive",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    }
  }

  for (const student of activeStudents) {
    totalProcessed += 1;

    try {
      const { subjects: desiredSubjects, issues } = buildDesiredSubjects(student, subjectIndex);

      if (issues.length) {
        skipped += 1;
        logs.push({
          type: "warning",
          message: `${student.fullName || student.name || student.id} skipped`,
          details: issues.join(", "),
        });
        continue;
      }

      const existing = enrollmentMap.get(student.id) || [];

      for (const subject of desiredSubjects) {
        const found = existing.find((e) => e.subjectId === subject.id);
        const ref = doc(
          db,
          ENROLLMENTS_COLLECTION,
          uniqueEnrollmentId(student.id, subject.id, academicYear)
        );
        const payload = enrollmentPayload(student, subject, academicYear);

        if (!found) created += 1;
        else if (found.status === "inactive") reactivated += 1;
        else updated += 1;

        operations.push((batch) => batch.set(ref, payload, { merge: true }));
      }
    } catch (error) {
      errors += 1;
      logs.push({
        type: "error",
        message: `${student.fullName || student.name || student.id} failed`,
        details: error.message,
      });
    }
  }

  await commitOperations(operations);

  return {
    mode: ENROLLMENT_MODES.FULL_REBUILD,
    totalProcessed,
    created,
    reactivated,
    updated,
    deactivated,
    skipped,
    errors,
    logs,
  };
}