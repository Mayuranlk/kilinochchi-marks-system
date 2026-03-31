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

/* -------------------------------------------------------------------------- */
/* Normalizers                                                                 */
/* -------------------------------------------------------------------------- */

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeLoose(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function normalizeAcademicYear(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d{4}/);
  return match ? match[0] : String(new Date().getFullYear());
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

function normalizeSection(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  const match = raw.match(/[A-Z]+/);
  return match ? match[0] : raw;
}

/* -------------------------------------------------------------------------- */
/* Student helpers                                                             */
/* -------------------------------------------------------------------------- */

function isStudentActive(student) {
  if (typeof student?.isActive === "boolean") return student.isActive;
  if (student?.status) return normalize(student.status) === "active";
  return true;
}

function isALStudent(student) {
  const grade = parseGrade(student?.grade);
  return grade >= 12 || !!student?.stream;
}

function getStudentName(student) {
  return student?.fullName || student?.name || "";
}

function getStudentSection(student) {
  return normalizeSection(student?.section || student?.className);
}

function getStudentFullClass(student) {
  const grade = parseGrade(student?.grade);
  const section = getStudentSection(student);
  if (grade && section) return `${grade}${section}`;
  if (section) return section;
  return "";
}

function getStudentReligion(student) {
  return student?.religion || "";
}

function getStudentAestheticChoice(student) {
  return student?.aestheticChoice || student?.aesthetic || "";
}

function getStudentBasketChoice(student, bucket) {
  if (bucket === "A") return student?.basketAChoice || student?.basket1 || "";
  if (bucket === "B") return student?.basketBChoice || student?.basket2 || "";
  if (bucket === "C") return student?.basketCChoice || student?.basket3 || "";
  return "";
}

function getStudentALChoices(student) {
  return toArray(student?.alSubjectChoices);
}

/* -------------------------------------------------------------------------- */
/* Subject helpers                                                             */
/* -------------------------------------------------------------------------- */

function isSubjectActive(subject) {
  if (typeof subject?.isActive === "boolean") return subject.isActive;
  if (subject?.status) return normalize(subject.status) === "active";
  return true;
}

function getSubjectName(subject) {
  return subject?.name || subject?.subjectName || subject?.shortName || "";
}

function getSubjectCode(subject) {
  return subject?.code || subject?.subjectCode || "";
}

function getSubjectCategory(subject) {
  return normalize(subject?.category);
}

function getSubjectId(subject) {
  return subject?.id || "";
}

function subjectKey(subject) {
  const subjectId = getSubjectId(subject);
  if (subjectId) return `id:${subjectId}`;
  return `name:${normalizeLoose(getSubjectName(subject))}`;
}

function valueMatches(subjectValue, studentValue) {
  const a = tokenSet(subjectValue);
  const b = tokenSet(studentValue);

  for (const token of a) {
    if (b.has(token)) return true;
  }
  return false;
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
    getSubjectId(subject),
    getSubjectCode(subject),
    subject?.subjectCode,
    getSubjectName(subject),
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

/* -------------------------------------------------------------------------- */
/* Subject index                                                               */
/* -------------------------------------------------------------------------- */

function buildSubjectIndex(subjects) {
  const activeSubjects = subjects.filter(isSubjectActive);

  const categoryIs = (subject, values) => values.includes(getSubjectCategory(subject));

  return {
    all: activeSubjects,

    core: activeSubjects.filter((s) =>
      categoryIs(s, ["core", "compulsory", "mandatory", "common"])
    ),

    religion: activeSubjects.filter((s) =>
      categoryIs(s, ["religion"])
    ),

    aesthetic: activeSubjects.filter((s) =>
      categoryIs(s, ["aesthetic"])
    ),

    basketA: activeSubjects.filter(
      (s) =>
        categoryIs(s, ["basket", "basket_a"]) ||
        normalize(String(s?.basketGroup || "")) === "a"
    ).filter((s) => {
      const bg = String(s?.basketGroup || "").toUpperCase();
      return bg === "A" || bg === "" || getSubjectCategory(s) === "basket_a";
    }),

    basketB: activeSubjects.filter(
      (s) =>
        categoryIs(s, ["basket", "basket_b"]) ||
        normalize(String(s?.basketGroup || "")) === "b"
    ).filter((s) => {
      const bg = String(s?.basketGroup || "").toUpperCase();
      return bg === "B" || bg === "" || getSubjectCategory(s) === "basket_b";
    }),

    basketC: activeSubjects.filter(
      (s) =>
        categoryIs(s, ["basket", "basket_c"]) ||
        normalize(String(s?.basketGroup || "")) === "c"
    ).filter((s) => {
      const bg = String(s?.basketGroup || "").toUpperCase();
      return bg === "C" || bg === "" || getSubjectCategory(s) === "basket_c";
    }),

    alMain: activeSubjects.filter((s) =>
      categoryIs(s, ["al_main", "al"])
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

function validateStudent(student, subjectIndex) {
  const errors = [];
  const grade = parseGrade(student?.grade);
  const section = getStudentSection(student);

  if (!grade) errors.push("Missing grade");
  if (!section) errors.push("Missing section");

  if (!grade) return errors;

  const isAL = isALStudent(student);

  const religionSubjects = subjectIndex.religion.filter((s) => subjectAppliesToGrade(s, grade));
  if (religionSubjects.length && !getStudentReligion(student)) {
    errors.push("Missing religion");
  }

  const aestheticSubjects = subjectIndex.aesthetic.filter((s) => subjectAppliesToGrade(s, grade));
  if (!isAL && grade >= 6 && grade <= 9 && aestheticSubjects.length && !getStudentAestheticChoice(student)) {
    errors.push("Missing aestheticChoice");
  }

  if (!isAL && (grade === 10 || grade === 11)) {
    if (subjectIndex.basketA.some((s) => subjectAppliesToGrade(s, grade)) && !getStudentBasketChoice(student, "A")) {
      errors.push("Missing basketAChoice");
    }
    if (subjectIndex.basketB.some((s) => subjectAppliesToGrade(s, grade)) && !getStudentBasketChoice(student, "B")) {
      errors.push("Missing basketBChoice");
    }
    if (subjectIndex.basketC.some((s) => subjectAppliesToGrade(s, grade)) && !getStudentBasketChoice(student, "C")) {
      errors.push("Missing basketCChoice");
    }
  }

  if (isAL) {
    if (!student?.stream) errors.push("Missing stream");
    if (!getStudentALChoices(student).length) {
      errors.push("Missing alSubjectChoices");
    }
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* Desired subject building                                                    */
/* -------------------------------------------------------------------------- */

function buildDesiredSubjects(student, subjectIndex) {
  const grade = parseGrade(student?.grade);
  const issues = validateStudent(student, subjectIndex);

  if (issues.length) {
    return { subjects: [], issues };
  }

  const desired = new Map();
  const isAL = isALStudent(student);

  const add = (subject) => {
    const key = subjectKey(subject);
    if (key) desired.set(key, subject);
  };

  subjectIndex.core
    .filter((s) => subjectAppliesToGrade(s, grade))
    .forEach(add);

  subjectIndex.religion
    .filter((s) => subjectAppliesToGrade(s, grade))
    .filter(
      (s) =>
        valueMatches(s?.religion, getStudentReligion(student)) ||
        valueMatches(s?.religionGroup, getStudentReligion(student)) ||
        valueMatches(getSubjectName(s), getStudentReligion(student))
    )
    .forEach(add);

  if (!isAL) {
    subjectIndex.aesthetic
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => subjectMatchesChoice(s, getStudentAestheticChoice(student)))
      .forEach(add);

    subjectIndex.basketA
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => subjectMatchesChoice(s, getStudentBasketChoice(student, "A")))
      .forEach(add);

    subjectIndex.basketB
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => subjectMatchesChoice(s, getStudentBasketChoice(student, "B")))
      .forEach(add);

    subjectIndex.basketC
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => subjectMatchesChoice(s, getStudentBasketChoice(student, "C")))
      .forEach(add);
  }

  if (isAL) {
    subjectIndex.alMain
      .filter((s) => subjectAppliesToGrade(s, grade))
      .filter((s) => {
        const streamOk =
          (!s?.stream && !s?.streams)
            ? true
            : valueMatches(s?.stream, student?.stream) ||
              valueMatches(s?.streams, student?.stream);

        const choiceOk = subjectMatchesChoice(s, getStudentALChoices(student));
        return streamOk && choiceOk;
      })
      .forEach(add);
  }

  if (!desired.size) {
    return { subjects: [], issues: ["No matching subjects found"] };
  }

  return { subjects: Array.from(desired.values()), issues: [] };
}

/* -------------------------------------------------------------------------- */
/* Enrollment payload                                                          */
/* -------------------------------------------------------------------------- */

function uniqueEnrollmentId(studentId, subjectId, academicYear) {
  return `${academicYear}_${studentId}_${subjectId}`;
}

function enrollmentPayload(student, subject, academicYear) {
  const gradeNumber = parseGrade(student?.grade);
  const section = getStudentSection(student);
  const fullClass = getStudentFullClass(student);

  return {
    studentId: student.id,
    studentName: getStudentName(student),
    admissionNo: student.admissionNo || student.indexNumber || "",

    grade: gradeNumber || null,
    section,
    className: fullClass,

    academicYear: normalizeAcademicYear(academicYear),

    subjectId: getSubjectId(subject),
    subjectName: getSubjectName(subject),
    subjectCode: getSubjectCode(subject),
    subjectCategory: getSubjectCategory(subject),

    religionKey: subject?.religion || "",
    basketGroup: subject?.basketGroup || "",
    stream: subject?.stream || "",
    medium: student?.medium || "",

    generatedBy: "system",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/* -------------------------------------------------------------------------- */
/* Firestore fetch                                                             */
/* -------------------------------------------------------------------------- */

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
    where("academicYear", "==", normalizeAcademicYear(academicYear))
  );
  const snap = await getDocs(q);
  return mapDocs(snap);
}

async function fetchEnrollmentsByStudent(academicYear, studentId) {
  const q = query(
    collection(db, ENROLLMENTS_COLLECTION),
    where("academicYear", "==", normalizeAcademicYear(academicYear)),
    where("studentId", "==", studentId)
  );
  const snap = await getDocs(q);
  return mapDocs(snap);
}

/* -------------------------------------------------------------------------- */
/* Enrollment matching                                                         */
/* -------------------------------------------------------------------------- */

function existingEnrollmentKey(enrollment) {
  if (enrollment?.subjectId) return `id:${enrollment.subjectId}`;
  return `name:${normalizeLoose(enrollment?.subjectName)}`;
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

function hasPayloadChanged(existingEnrollment, payload) {
  return (
    existingEnrollment.subjectName !== payload.subjectName ||
    existingEnrollment.subjectCode !== payload.subjectCode ||
    existingEnrollment.grade !== payload.grade ||
    existingEnrollment.section !== payload.section ||
    existingEnrollment.className !== payload.className ||
    existingEnrollment.status !== "active" ||
    (existingEnrollment.subjectCategory || "") !== (payload.subjectCategory || "") ||
    (existingEnrollment.basketGroup || "") !== (payload.basketGroup || "") ||
    (existingEnrollment.stream || "") !== (payload.stream || "") ||
    (existingEnrollment.medium || "") !== (payload.medium || "")
  );
}

/* -------------------------------------------------------------------------- */
/* Batch commit                                                                */
/* -------------------------------------------------------------------------- */

async function commitOperations(operations) {
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + BATCH_LIMIT);
    chunk.forEach((fn) => fn(batch));
    await batch.commit();
  }
}

/* -------------------------------------------------------------------------- */
/* Generate missing                                                            */
/* -------------------------------------------------------------------------- */

export async function generateMissingEnrollments({ academicYear }) {
  const normalizedYear = normalizeAcademicYear(academicYear);

  const [students, subjects, enrollments] = await Promise.all([
    fetchStudents(),
    fetchSubjects(),
    fetchEnrollmentsByYear(normalizedYear),
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
          message: `${getStudentName(student) || student.id} skipped`,
          details: issues.join(", "),
        });
        continue;
      }

      const existing = enrollmentMap.get(student.id) || [];
      const existingByKey = new Map(existing.map((e) => [existingEnrollmentKey(e), e]));

      for (const subject of desiredSubjects) {
        const desiredKey = subjectKey(subject);
        const existingEnrollment = existingByKey.get(desiredKey);

        const canonicalRef = doc(
          db,
          ENROLLMENTS_COLLECTION,
          uniqueEnrollmentId(student.id, getSubjectId(subject), normalizedYear)
        );
        const payload = enrollmentPayload(student, subject, normalizedYear);

        if (!existingEnrollment) {
          created += 1;
          operations.push((batch) => batch.set(canonicalRef, payload, { merge: true }));
          continue;
        }

        if (existingEnrollment.status === "inactive") {
          reactivated += 1;
          operations.push((batch) => batch.set(canonicalRef, payload, { merge: true }));

          if (existingEnrollment.id !== canonicalRef.id) {
            const oldRef = doc(db, ENROLLMENTS_COLLECTION, existingEnrollment.id);
            operations.push((batch) =>
              batch.set(
                oldRef,
                { status: "inactive", updatedAt: serverTimestamp() },
                { merge: true }
              )
            );
          }
          continue;
        }

        if (hasPayloadChanged(existingEnrollment, payload) || existingEnrollment.id !== canonicalRef.id) {
          updated += 1;
          operations.push((batch) => batch.set(canonicalRef, payload, { merge: true }));

          if (existingEnrollment.id !== canonicalRef.id) {
            const oldRef = doc(db, ENROLLMENTS_COLLECTION, existingEnrollment.id);
            operations.push((batch) =>
              batch.set(
                oldRef,
                { status: "inactive", updatedAt: serverTimestamp() },
                { merge: true }
              )
            );
          }
        }
      }
    } catch (error) {
      errors += 1;
      logs.push({
        type: "error",
        message: `${getStudentName(student) || student.id} failed`,
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

/* -------------------------------------------------------------------------- */
/* Regenerate one student                                                      */
/* -------------------------------------------------------------------------- */

export async function regenerateSingleStudent({ academicYear, studentId }) {
  const normalizedYear = normalizeAcademicYear(academicYear);

  const [students, subjects, existingEnrollments] = await Promise.all([
    fetchStudents(),
    fetchSubjects(),
    fetchEnrollmentsByStudent(normalizedYear, studentId),
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
          message: `${getStudentName(student) || student.id} skipped`,
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
          message: `${getStudentName(student) || student.id} skipped`,
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
    const existing = existingEnrollments.find(
      (e) => existingEnrollmentKey(e) === subjectKey(subject)
    );

    const ref = doc(
      db,
      ENROLLMENTS_COLLECTION,
      uniqueEnrollmentId(student.id, getSubjectId(subject), normalizedYear)
    );
    const payload = enrollmentPayload(student, subject, normalizedYear);

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
        message: `${getStudentName(student) || student.id} regenerated`,
        details: `Subjects rebuilt: ${desiredSubjects.length}`,
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Full rebuild                                                                */
/* -------------------------------------------------------------------------- */

export async function fullRebuildEnrollments({ academicYear }) {
  const normalizedYear = normalizeAcademicYear(academicYear);

  const [students, subjects, enrollments] = await Promise.all([
    fetchStudents(),
    fetchSubjects(),
    fetchEnrollmentsByYear(normalizedYear),
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
          message: `${getStudentName(student) || student.id} skipped`,
          details: issues.join(", "),
        });
        continue;
      }

      const existing = enrollmentMap.get(student.id) || [];

      for (const subject of desiredSubjects) {
        const found = existing.find(
          (e) => existingEnrollmentKey(e) === subjectKey(subject)
        );

        const ref = doc(
          db,
          ENROLLMENTS_COLLECTION,
          uniqueEnrollmentId(student.id, getSubjectId(subject), normalizedYear)
        );
        const payload = enrollmentPayload(student, subject, normalizedYear);

        if (!found) created += 1;
        else if (found.status === "inactive") reactivated += 1;
        else updated += 1;

        operations.push((batch) => batch.set(ref, payload, { merge: true }));
      }
    } catch (error) {
      errors += 1;
      logs.push({
        type: "error",
        message: `${getStudentName(student) || student.id} failed`,
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