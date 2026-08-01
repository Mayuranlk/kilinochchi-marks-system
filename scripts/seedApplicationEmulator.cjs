const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "demo-kilinochchi-rules";
const AUTH_HOST = "127.0.0.1:9099";
const FIRESTORE_HOST = "127.0.0.1:8085";
const PASSWORD = "EmulatorOnly!123";
const requestedStudentCount = Number(process.env.APP_EMULATOR_STUDENT_COUNT || 2);
const STUDENT_COUNT = Number.isInteger(requestedStudentCount)
  ? Math.min(1000, Math.max(2, requestedStudentCount))
  : 2;

function assertEmulatorIsolation() {
  if (process.env.GCLOUD_PROJECT !== PROJECT_ID) {
    throw new Error(`Refusing seed: GCLOUD_PROJECT must be ${PROJECT_ID}.`);
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== AUTH_HOST) {
    throw new Error(`Refusing seed: FIREBASE_AUTH_EMULATOR_HOST must be ${AUTH_HOST}.`);
  }
  if (process.env.FIRESTORE_EMULATOR_HOST !== FIRESTORE_HOST) {
    throw new Error(`Refusing seed: FIRESTORE_EMULATOR_HOST must be ${FIRESTORE_HOST}.`);
  }
  if (!PROJECT_ID.startsWith("demo-")) {
    throw new Error("Refusing seed: project ID must use Firebase's demo- prefix.");
  }
}

const USERS = {
  admin: { uid: "app-admin", email: "admin@app-emulator.test", role: "admin", name: "Synthetic Admin" },
  teacher: { uid: "app-teacher", email: "teacher@app-emulator.test", role: "teacher", name: "Synthetic Teacher", isSubjectTeacher: true, isClassTeacher: true, classGrade: 10, classSection: "A" },
  it: { uid: "app-it-teacher", email: "it@app-emulator.test", role: "it_teacher", name: "Synthetic IT Teacher" },
  sectional: { uid: "app-sectional", email: "sectional@app-emulator.test", role: "sectional_head", name: "Synthetic Sectional Head", assignedGrades: [10] },
  account: { uid: "app-account", email: "account@app-emulator.test", role: "account", name: "Synthetic Accounts User" },
  prefect: { uid: "app-prefect", email: "prefect@app-emulator.test", role: "prefect", name: "Synthetic Prefect" },
  capabilityTeacher: { uid: "app-capability-teacher", email: "capability-teacher@app-emulator.test", role: "support", name: "Synthetic Capability Teacher", isSubjectTeacher: true },
  unknown: { uid: "app-unknown", email: "unknown@app-emulator.test", role: "unknown", name: "Synthetic Unknown User" },
};

function canonicalMark(studentId, value, suffix) {
  return {
    schemaVersion: 2,
    studentId,
    subjectId: "subject-mathematics",
    academicYearKey: "2026",
    termKey: "term-1",
    gradeNumber: 10,
    classKey: "10a",
    subjectKey: "subject-mathematics",
    assessmentKey: "term",
    markKey: `${studentId}__2026__term-1__term__subject-mathematics`,
    mark: value,
    marks: value,
    score: value,
    absent: false,
    isAbsent: false,
    teacherId: USERS.teacher.uid,
    subjectName: "Mathematics",
    academicYear: "2026",
    year: "2026",
    term: "Term 1",
    termName: "Term 1",
    grade: 10,
    section: "A",
    className: "A",
    fullClassName: "10A",
    assessmentType: "term",
    attendancePercentage: 92,
    synthetic: true,
    suffix,
  };
}

async function seedAuth(auth) {
  for (const profile of Object.values(USERS)) {
    try {
      await auth.createUser({
        uid: profile.uid,
        email: profile.email,
        emailVerified: true,
        password: PASSWORD,
        displayName: profile.name,
      });
    } catch (error) {
      if (error.code !== "auth/uid-already-exists" && error.code !== "auth/email-already-exists") throw error;
      await auth.updateUser(profile.uid, { password: PASSWORD, displayName: profile.name });
    }
  }
}

async function seedFirestore(db) {
  const now = Timestamp.fromDate(new Date("2026-08-01T06:00:00Z"));
  const rows = [];
  for (const profile of Object.values(USERS)) {
    rows.push(["users", profile.uid, { ...profile, status: "active", synthetic: true, createdAt: now }]);
  }

  rows.push(
    ["students", "student-001", { studentId: "student-001", admissionNo: "SYN001", indexNo: "SYN001", emisStudentId: "SYN-EMIS-001", name: "Synthetic Student One", fullName: "Synthetic Student One", grade: 10, gradeNumber: 10, section: "A", className: "A", fullClassName: "10A", classKey: "10-a", academicYear: "2026", academicYearKey: "2026", medium: "Tamil", status: "active", schemaVersion: 2, gender: "Male", synthetic: true }],
    ["students", "student-002", { studentId: "student-002", admissionNo: "SYN002", indexNo: "SYN002", emisStudentId: "SYN-EMIS-002", name: "Synthetic Student Two", fullName: "Synthetic Student Two", grade: 10, gradeNumber: 10, section: "A", className: "A", fullClassName: "10A", classKey: "10-a", academicYear: "2026", academicYearKey: "2026", medium: "Tamil", status: "active", schemaVersion: 2, gender: "Female", synthetic: true }],
    ["classrooms", "class-10-a", { grade: 10, gradeNumber: 10, section: "A", className: "A", name: "10A", fullClassName: "10A", displayClassName: "Grade 10 A", classKey: "10-a", academicYear: "2026", academicYearKey: "2026", status: "active", classTeacherId: USERS.teacher.uid, classTeacherUid: USERS.teacher.uid, classTeacherName: USERS.teacher.name, synthetic: true }],
    ["subjects", "subject-mathematics", { name: "Mathematics", subjectName: "Mathematics", subjectCode: "MATH", subjectKey: "mathematics", grade: 10, medium: "Tamil", category: "Core", status: "active", isActive: true, synthetic: true }],
    ["subjects", "subject-tamil", { name: "Tamil", subjectName: "Tamil", subjectCode: "TAM", subjectKey: "tamil", grade: 10, medium: "Tamil", category: "Core", status: "active", isActive: true, synthetic: true }],
    ["academicTerms", "term-2026-1", { term: "Term 1", termName: "Term 1", name: "Term 1", year: 2026, academicYear: "2026", academicYearKey: "2026", termKey: "term-1", isActive: true, active: true, status: "active", startDate: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")), endDate: Timestamp.fromDate(new Date("2026-04-30T00:00:00Z")), synthetic: true }],
    ["practiceExams", "practice-2026-1", { name: "Synthetic Practice 1", examName: "Synthetic Practice 1", term: "Term 1", termName: "Term 1", year: 2026, academicYear: "2026", subjectId: "subject-mathematics", subjectName: "Mathematics", assessmentKey: "practice-1", status: "active", synthetic: true }],
    ["teacherAssignments", "assignment-teacher-maths-10a", { teacherId: USERS.teacher.uid, teacherUid: USERS.teacher.uid, teacherName: USERS.teacher.name, subjectId: "subject-mathematics", subjectName: "Mathematics", subjectKey: "mathematics", grade: 10, gradeNumber: 10, section: "A", className: "A", fullClassName: "10A", classKey: "10-a", academicYear: "2026", academicYearKey: "2026", medium: "Tamil", status: "active", synthetic: true }],
    ["teacherAssignments", "assignment-it-maths-10a", { teacherId: USERS.it.uid, teacherUid: USERS.it.uid, teacherName: USERS.it.name, subjectId: "subject-mathematics", subjectName: "Mathematics", subjectKey: "mathematics", grade: 10, gradeNumber: 10, section: "A", className: "A", fullClassName: "10A", classKey: "10-a", academicYear: "2026", academicYearKey: "2026", medium: "Tamil", status: "active", synthetic: true }],
    ["studentSubjectEnrollments", "enrollment-001-maths", { schemaVersion: 2, enrollmentKey: "student-001__2026__mathematics", studentId: "student-001", subjectId: "subject-mathematics", subjectName: "Mathematics", subjectKey: "mathematics", grade: 10, gradeNumber: 10, section: "A", className: "A", fullClassName: "10A", classKey: "10-a", academicYear: "2026", academicYearKey: "2026", medium: "Tamil", status: "active", synthetic: true }],
    ["studentSubjectEnrollments", "enrollment-002-maths", { schemaVersion: 2, enrollmentKey: "student-002__2026__mathematics", studentId: "student-002", subjectId: "subject-mathematics", subjectName: "Mathematics", subjectKey: "mathematics", grade: 10, gradeNumber: 10, section: "A", className: "A", fullClassName: "10A", classKey: "10-a", academicYear: "2026", academicYearKey: "2026", medium: "Tamil", status: "active", synthetic: true }],
    ["marks", "mark-synthetic-001", canonicalMark("student-001", 74, "001")],
    ["marks", "mark-synthetic-002", canonicalMark("student-002", 63, "002")],
    ["systemSettings", "marksEntry", { teacherEntryEnabled: true, teacherEntryDeadline: "", updatedAt: now, synthetic: true }],
    ["studentFeeAccounts", "2026_student-001", { studentId: "student-001", academicYear: "2026", payments: [], feeStructure: { facilities: 60, development: 1800, membership: 600 }, updatedAt: now, synthetic: true }],
    ["lateArrivalRecords", "2026-07-31_student-001", { studentId: "student-001", studentName: "Synthetic Student One", admissionNo: "SYN001", grade: 10, section: "A", classLabel: "Grade 10 - A", dateKey: "2026-07-31", arrivalTime: Timestamp.fromDate(new Date("2026-07-31T02:45:00Z")), reason: "Transport delay", recordBookReceived: true, bookStatus: "held", recordedBy: { uid: USERS.prefect.uid, name: USERS.prefect.name, email: USERS.prefect.email }, recordedAt: now, handoverHistory: [], synthetic: true }],
    ["elections", "student-parliament-2026", { id: "student-parliament-2026", title: "Synthetic Student Parliament Election", organizer: "Synthetic QA", candidateCount: 150, candidates: Array.from({ length: 150 }, (_, index) => ({ number: index + 1, label: `Candidate ${String(index + 1).padStart(3, "0")}`, votes: index === 0 ? 1 : 0 })), registeredVoters: 10, votedVoters: 1, rejectedVotes: 0, entries: [], createdAtText: "2026-08-01T00:00:00.000Z", updatedAtText: "2026-08-01T00:00:00.000Z", synthetic: true }],
    ["auditLogs", "audit-seed", { action: "synthetic-emulator-seed", actorUid: USERS.admin.uid, createdAt: now, synthetic: true }],
    ["classShufflePlans", "shuffle-seed", { status: "draft", grade: 10, academicYear: "2026", synthetic: true }],
    ["promotionHistory", "promotion-seed", { status: "complete", fromYear: "2025", toYear: "2026", synthetic: true }],
    ["teachers", "legacy-teacher-seed", { uid: USERS.teacher.uid, name: USERS.teacher.name, role: "teacher", status: "active", synthetic: true }]
  );

  // Optional scale data is strictly emulator-only and leaves the two stable
  // smoke-test students untouched. It provides realistic list/report render
  // measurements without importing production or personal data.
  for (let index = 3; index <= STUDENT_COUNT; index += 1) {
    const suffix = String(index).padStart(4, "0");
    const studentId = `student-${suffix}`;
    const studentName = `Performance Student ${suffix}`;
    rows.push(
      ["students", studentId, {
        studentId,
        admissionNo: `PERF${suffix}`,
        indexNo: `PERF${suffix}`,
        emisStudentId: `PERF-EMIS-${suffix}`,
        name: studentName,
        fullName: studentName,
        grade: 10,
        gradeNumber: 10,
        section: "A",
        className: "A",
        fullClassName: "10A",
        classKey: "10-a",
        academicYear: "2026",
        academicYearKey: "2026",
        medium: "Tamil",
        status: "Active",
        schemaVersion: 2,
        gender: index % 2 === 0 ? "Female" : "Male",
        synthetic: true,
      }],
      ["studentSubjectEnrollments", `enrollment-${suffix}-maths`, {
        schemaVersion: 2,
        enrollmentKey: `${studentId}__2026__mathematics`,
        studentId,
        subjectId: "subject-mathematics",
        subjectName: "Mathematics",
        subjectKey: "mathematics",
        grade: 10,
        gradeNumber: 10,
        section: "A",
        className: "A",
        fullClassName: "10A",
        classKey: "10-a",
        academicYear: "2026",
        academicYearKey: "2026",
        medium: "Tamil",
        status: "active",
        synthetic: true,
      }],
      ["marks", `mark-performance-${suffix}`, canonicalMark(studentId, 35 + (index % 61), suffix)]
    );
  }

  const writer = db.bulkWriter();
  for (const [collectionName, id, data] of rows) {
    writer.set(db.collection(collectionName).doc(id), { ...data, emulatorSeedVersion: 1 });
  }
  await writer.close();
  await db.collection("auditLogs").doc("seed-complete").set({
    action: "synthetic-emulator-seed-complete",
    documentCount: rows.length,
    createdAt: FieldValue.serverTimestamp(),
    synthetic: true,
  });
  return rows.length + 1;
}

async function main() {
  assertEmulatorIsolation();
  const app = getApps()[0] || initializeApp({ projectId: PROJECT_ID });
  await seedAuth(getAuth(app));
  const count = await seedFirestore(getFirestore(app));
  process.stdout.write(`${JSON.stringify({ projectId: PROJECT_ID, users: Object.keys(USERS).length, students: STUDENT_COUNT, documents: count, syntheticOnly: true })}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = { PROJECT_ID, USERS, PASSWORD };
