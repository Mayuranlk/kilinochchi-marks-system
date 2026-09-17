const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} = require("firebase/firestore");

const PROJECT_ID = "demo-kilinochchi-rules";
const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_PORT = 8085;

const COLLECTIONS = {
  users: "users",
  students: "students",
  subjects: "subjects",
  classrooms: "classrooms",
  terms: "academicTerms",
  exams: "practiceExams",
  assignments: "teacherAssignments",
  enrollments: "studentSubjectEnrollments",
  marks: "marks",
  settings: "systemSettings",
  fees: "studentFeeAccounts",
  late: "lateArrivalRecords",
  elections: "elections",
  audit: "auditLogs",
  shuffle: "classShufflePlans",
  promotion: "promotionHistory",
  teachers: "teachers",
};

const IDS = {
  admin: "admin-test",
  teacher: "teacher-test",
  it: "it-test",
  section: "section-test",
  account: "account-test",
  prefect: "prefect-test",
  subjectFlag: "subject-flag-test",
  itFlag: "it-flag-test",
  sectionFlag: "section-flag-test",
  prefectFlag: "prefect-flag-test",
  unknown: "unknown-test",
  missing: "missing-profile-test",
};

let testEnv;

function dbFor(uid) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
}

function unauthenticatedDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function validMark(uid, suffix = "base", overrides = {}) {
  const mark = {
    schemaVersion: 2,
    studentId: `student-${suffix}`,
    subjectId: "subject-maths",
    academicYearKey: "2026",
    termKey: "term-1",
    gradeNumber: 10,
    classKey: "10-A",
    subjectKey: "maths",
    assessmentKey: "term-1",
    markKey: `2026|term-1|10-A|maths|student-${suffix}`,
    mark: 75,
    marks: 75,
    score: 75,
    absent: false,
    isAbsent: false,
    teacherId: uid,
    attendancePercentage: 90,
  };
  return { ...mark, ...overrides };
}

function validLateArrival(uid, suffix = "base", overrides = {}) {
  return {
    studentId: `student-${suffix}`,
    dateKey: "2026-08-01",
    arrivalTime: Timestamp.fromDate(new Date("2026-08-01T02:45:00Z")),
    reason: "Synthetic emulator test",
    recordBookReceived: true,
    bookStatus: "held",
    recordedBy: { uid },
    recordedAt: Timestamp.fromDate(new Date("2026-08-01T02:46:00Z")),
    handoverHistory: [],
    ...overrides,
  };
}

async function seedSyntheticData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const profiles = {
      [IDS.admin]: { role: "admin" },
      [IDS.teacher]: { role: "teacher" },
      [IDS.it]: { role: "it_teacher" },
      [IDS.section]: { role: "sectional_head" },
      [IDS.account]: { role: "account" },
      [IDS.prefect]: { role: "prefect" },
      [IDS.subjectFlag]: { role: "unknown", isSubjectTeacher: true },
      [IDS.itFlag]: { role: "unknown", canAccessAllReports: true },
      [IDS.sectionFlag]: { role: "unknown", isSectionalHead: true },
      [IDS.prefectFlag]: { role: "unknown", isPrefect: true },
      [IDS.unknown]: { role: "unknown" },
    };
    await Promise.all(
      Object.entries(profiles).map(([uid, profile]) =>
        setDoc(doc(db, COLLECTIONS.users, uid), profile)
      )
    );

    const rows = [
      [COLLECTIONS.students, "student-1", { admissionNo: "A001", academicYearKey: "2026", classKey: "10-A", grade: 10, status: "active" }],
      [COLLECTIONS.students, "student-2", { admissionNo: "A002", academicYearKey: "2026", classKey: "10-A", grade: "10", status: "active" }],
      [COLLECTIONS.subjects, "subject-maths", { name: "Mathematics", subjectKey: "maths" }],
      [COLLECTIONS.classrooms, "class-10-a", { classKey: "10-A", grade: 10 }],
      [COLLECTIONS.terms, "term-1", { termKey: "term-1", academicYearKey: "2026" }],
      [COLLECTIONS.exams, "exam-1", { assessmentKey: "term-1" }],
      [COLLECTIONS.assignments, "assignment-1", { teacherId: IDS.teacher, academicYearKey: "2026", status: "active" }],
      [COLLECTIONS.enrollments, "enrollment-1", { studentId: "student-1", academicYearKey: "2026", classKey: "10-A", subjectKey: "maths", status: "active" }],
      [COLLECTIONS.marks, "mark-1", validMark(IDS.teacher, "1")],
      [COLLECTIONS.settings, "marks-entry", { enabled: true }],
      [COLLECTIONS.fees, "fee-1", { studentId: "student-1", balance: 0 }],
      [COLLECTIONS.late, "late-1", validLateArrival(IDS.prefect, "1")],
      [COLLECTIONS.elections, "election-1", { status: "open" }],
      [COLLECTIONS.audit, "audit-1", { action: "synthetic" }],
      [COLLECTIONS.shuffle, "shuffle-1", { status: "draft" }],
      [COLLECTIONS.promotion, "promotion-1", { status: "complete" }],
      [COLLECTIONS.teachers, "legacy-teacher-1", { active: true }],
      ["unmatchedSynthetic", "secret-1", { value: true }],
    ];
    await Promise.all(rows.map(([name, id, data]) => setDoc(doc(db, name, id), data)));
  });
}

async function expectCollectionReads(uid, allowed, denied) {
  const db = dbFor(uid);
  for (const name of allowed) {
    await assertSucceeds(getDocs(collection(db, name)));
  }
  for (const name of denied) {
    await assertFails(getDocs(collection(db, name)));
  }
}

before(async () => {
  assert.equal(
    process.env.FIRESTORE_EMULATOR_HOST,
    `${EMULATOR_HOST}:${EMULATOR_PORT}`,
    "Refusing to run without the dedicated local Firestore emulator host"
  );
  assert.ok(PROJECT_ID.startsWith("demo-"), "Emulator project ID must use Firebase's demo- prefix");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMULATOR_HOST, port: EMULATOR_PORT },
  });
  await testEnv.clearFirestore();
  await seedSyntheticData();
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

test("unauthenticated access is denied on every explicit and fallback collection", async () => {
  const db = unauthenticatedDb();
  for (const name of [...Object.values(COLLECTIONS), "unmatchedSynthetic"]) {
    await assertFails(getDocs(collection(db, name)));
  }
});

test("unknown and missing-profile users get only their own profile and elections", async () => {
  for (const uid of [IDS.unknown, IDS.missing]) {
    const db = dbFor(uid);
    await assertSucceeds(getDoc(doc(db, COLLECTIONS.users, uid)));
    await assertFails(getDocs(collection(db, COLLECTIONS.users)));
    await assertSucceeds(getDocs(collection(db, COLLECTIONS.elections)));
    await assertFails(getDocs(collection(db, COLLECTIONS.students)));
    await assertFails(setDoc(doc(db, COLLECTIONS.users, `${uid}-attempt`), { role: "admin" }));
    await assertFails(setDoc(doc(db, "unmatchedSynthetic", `${uid}-attempt`), { value: true }));
  }
});

test("academic roles retain current broad read/query compatibility without metadata writes", async () => {
  const academic = [
    COLLECTIONS.users,
    COLLECTIONS.students,
    COLLECTIONS.subjects,
    COLLECTIONS.classrooms,
    COLLECTIONS.terms,
    COLLECTIONS.exams,
    COLLECTIONS.assignments,
    COLLECTIONS.enrollments,
    COLLECTIONS.marks,
    COLLECTIONS.settings,
    COLLECTIONS.elections,
  ];
  const denied = [COLLECTIONS.fees, COLLECTIONS.late, COLLECTIONS.audit, COLLECTIONS.shuffle, COLLECTIONS.promotion, COLLECTIONS.teachers];
  for (const uid of [IDS.teacher, IDS.it, IDS.section, IDS.subjectFlag, IDS.itFlag, IDS.sectionFlag]) {
    await expectCollectionReads(uid, academic, denied);
    await assertFails(updateDoc(doc(dbFor(uid), COLLECTIONS.students, "student-1"), { status: "inactive" }));
  }
});

test("account and prefect collection boundaries and capability flags are enforced", async () => {
  await expectCollectionReads(IDS.account, [COLLECTIONS.students, COLLECTIONS.fees, COLLECTIONS.elections], [COLLECTIONS.users, COLLECTIONS.subjects, COLLECTIONS.marks, COLLECTIONS.late]);
  await expectCollectionReads(IDS.prefect, [COLLECTIONS.students, COLLECTIONS.late, COLLECTIONS.elections], [COLLECTIONS.users, COLLECTIONS.subjects, COLLECTIONS.marks, COLLECTIONS.fees]);
  await expectCollectionReads(IDS.prefectFlag, [COLLECTIONS.students, COLLECTIONS.late, COLLECTIONS.elections], [COLLECTIONS.users, COLLECTIONS.subjects, COLLECTIONS.marks, COLLECTIONS.fees]);
});

test("only admin can manage user profiles and all explicitly administrative collections", async () => {
  const db = dbFor(IDS.admin);
  const explicit = Object.values(COLLECTIONS);
  for (const name of explicit) {
    const ref = doc(db, name, `admin-crud-${name}`);
    await assertSucceeds(setDoc(ref, { synthetic: true }));
    await assertSucceeds(updateDoc(ref, { synthetic: false }));
    await assertSucceeds(deleteDoc(ref));
  }
  await assertFails(setDoc(doc(db, "unmatchedSynthetic", "admin-denied"), { value: true }));

  const teacherDb = dbFor(IDS.teacher);
  await assertFails(updateDoc(doc(teacherDb, COLLECTIONS.users, IDS.teacher), { role: "admin" }));
  await assertFails(deleteDoc(doc(teacherDb, COLLECTIONS.users, IDS.teacher)));
});

test("teacher mark creates accept canonical payloads and reject identity, aliases, ranges, and types", async () => {
  const db = dbFor(IDS.teacher);
  await assertSucceeds(setDoc(doc(db, COLLECTIONS.marks, "valid-create"), validMark(IDS.teacher, "valid-create")));
  await assertSucceeds(setDoc(doc(db, COLLECTIONS.marks, "blank-create"), validMark(IDS.teacher, "blank-create", { mark: null, marks: null, score: null })));
  await assertSucceeds(setDoc(doc(db, COLLECTIONS.marks, "absent-create"), validMark(IDS.teacher, "absent-create", { mark: null, marks: null, score: null, absent: true, isAbsent: true })));

  const invalid = [
    ["other-teacher", { teacherId: IDS.it }],
    ["below-zero", { mark: -1, marks: -1, score: -1 }],
    ["above-100", { mark: 101, marks: 101, score: 101 }],
    ["string-mark", { mark: "75", marks: "75", score: "75" }],
    ["object-mark", { mark: { value: 75 }, marks: { value: 75 }, score: { value: 75 } }],
    ["array-mark", { mark: [75], marks: [75], score: [75] }],
    ["numeric-absent", { absent: true, isAbsent: true }],
    ["mark-alias", { marks: 74 }],
    ["absent-alias", { isAbsent: true }],
    ["bad-attendance-low", { attendancePercentage: -1 }],
    ["bad-attendance-high", { attendancePercentage: 101 }],
    ["bad-attendance-type", { attendancePercentage: "90" }],
  ];
  for (const [suffix, overrides] of invalid) {
    await assertFails(setDoc(doc(db, COLLECTIONS.marks, `invalid-${suffix}`), validMark(IDS.teacher, suffix, overrides)));
  }
  const requiredTextKeys = ["studentId", "subjectId", "academicYearKey", "termKey", "classKey", "subjectKey", "assessmentKey", "markKey"];
  for (const key of requiredTextKeys) {
    const blank = validMark(IDS.teacher, `blank-${key}`, { [key]: "" });
    await assertFails(setDoc(doc(db, COLLECTIONS.marks, `invalid-blank-${key}`), blank));
    const missing = validMark(IDS.teacher, `missing-${key}`);
    delete missing[key];
    await assertFails(setDoc(doc(db, COLLECTIONS.marks, `invalid-missing-${key}`), missing));
  }
});

test("teacher updates preserve mark identity and teacher delete remains denied", async () => {
  const db = dbFor(IDS.teacher);
  const ref = doc(db, COLLECTIONS.marks, "teacher-update");
  await assertSucceeds(setDoc(ref, validMark(IDS.teacher, "teacher-update")));
  await assertSucceeds(updateDoc(ref, { mark: 88, marks: 88, score: 88 }));
  await assertFails(updateDoc(ref, { studentId: "different-student" }));
  await assertFails(updateDoc(ref, { markKey: "different-key" }));
  await assertFails(deleteDoc(ref));

  await assertFails(setDoc(doc(dbFor(IDS.section), COLLECTIONS.marks, "section-write"), validMark(IDS.section, "section-write")));
  await assertSucceeds(setDoc(doc(dbFor(IDS.subjectFlag), COLLECTIONS.marks, "subject-flag-write"), validMark(IDS.subjectFlag, "subject-flag-write")));
  await assertSucceeds(setDoc(doc(dbFor(IDS.itFlag), COLLECTIONS.marks, "it-flag-write"), validMark(IDS.itFlag, "it-flag-write")));
});

test("account fee workflow and prefect late-arrival workflow enforce their write boundaries", async () => {
  const accountDb = dbFor(IDS.account);
  const feeRef = doc(accountDb, COLLECTIONS.fees, "account-fee");
  await assertSucceeds(setDoc(feeRef, { studentId: "student-1", balance: 100 }));
  await assertSucceeds(updateDoc(feeRef, { balance: 50 }));
  await assertFails(deleteDoc(feeRef));

  const prefectDb = dbFor(IDS.prefect);
  const lateRef = doc(prefectDb, COLLECTIONS.late, "prefect-late");
  await assertSucceeds(setDoc(lateRef, validLateArrival(IDS.prefect, "prefect-late")));
  await assertSucceeds(updateDoc(lateRef, {
    bookStatus: "returned",
    returnedAt: Timestamp.fromDate(new Date("2026-08-01T06:00:00Z")),
    handedOverBy: { uid: IDS.prefect },
    handoverHistory: [{ action: "returned" }],
  }));
  await assertFails(deleteDoc(lateRef));
  await assertFails(setDoc(doc(prefectDb, COLLECTIONS.late, "wrong-recorder"), validLateArrival(IDS.admin, "wrong-recorder")));
  await assertFails(setDoc(doc(prefectDb, COLLECTIONS.late, "extra-field"), validLateArrival(IDS.prefect, "extra-field", { unexpected: true })));
  await assertFails(setDoc(doc(prefectDb, COLLECTIONS.late, "bad-arrival-time"), validLateArrival(IDS.prefect, "bad-arrival-time", { arrivalTime: "08:15" })));
  await assertFails(setDoc(doc(prefectDb, COLLECTIONS.late, "bad-status"), validLateArrival(IDS.prefect, "bad-status", { bookStatus: "returned" })));
  await assertFails(setDoc(doc(prefectDb, COLLECTIONS.late, "bad-recorded-at"), validLateArrival(IDS.prefect, "bad-recorded-at", { recordedAt: "now" })));
  await assertFails(setDoc(doc(prefectDb, COLLECTIONS.late, "bad-history"), validLateArrival(IDS.prefect, "bad-history", { handoverHistory: {} })));
  await assertFails(updateDoc(doc(prefectDb, COLLECTIONS.late, "late-1"), { reason: "Changed" }));
});

test("elections, settings, administrative paths, and fallback deny match the matrix", async () => {
  const unknownDb = dbFor(IDS.unknown);
  await assertSucceeds(getDoc(doc(unknownDb, COLLECTIONS.elections, "election-1")));
  await assertFails(updateDoc(doc(unknownDb, COLLECTIONS.elections, "election-1"), { status: "closed" }));
  await assertSucceeds(getDoc(doc(dbFor(IDS.teacher), COLLECTIONS.settings, "marks-entry")));
  await assertFails(updateDoc(doc(dbFor(IDS.teacher), COLLECTIONS.settings, "marks-entry"), { enabled: false }));
  for (const name of [COLLECTIONS.audit, COLLECTIONS.shuffle, COLLECTIONS.promotion, COLLECTIONS.teachers]) {
    await assertFails(getDocs(collection(dbFor(IDS.teacher), name)));
    await assertSucceeds(getDocs(collection(dbFor(IDS.admin), name)));
  }
  await assertFails(getDoc(doc(dbFor(IDS.admin), "unmatchedSynthetic", "secret-1")));
});

test("active list, filtered, ordered, aggregation, scoped, and paginated query shapes authorize correctly", async () => {
  const teacherDb = dbFor(IDS.teacher);
  await assertSucceeds(getDocs(query(collection(teacherDb, COLLECTIONS.users), where("role", "==", "teacher"))));
  await assertSucceeds(getDocs(query(collection(teacherDb, COLLECTIONS.marks), where("studentId", "==", "student-1"))));
  await assertSucceeds(getDocs(query(collection(teacherDb, COLLECTIONS.enrollments), where("studentId", "==", "student-1"))));
  await assertSucceeds(getDocs(query(
    collection(teacherDb, COLLECTIONS.marks),
    where("academicYearKey", "==", "2026"),
    where("termKey", "==", "term-1"),
    where("classKey", "==", "10-A"),
    where("assessmentKey", "==", "term-1"),
    where("subjectKey", "==", "maths")
  )));
  await assertSucceeds(getCountFromServer(collection(teacherDb, COLLECTIONS.marks)));

  const firstPage = await assertSucceeds(getDocs(query(
    collection(teacherDb, COLLECTIONS.students),
    where("academicYearKey", "==", "2026"),
    where("classKey", "==", "10-A"),
    where("status", "==", "active"),
    orderBy("admissionNo"),
    limit(1)
  )));
  assert.equal(firstPage.size, 1);
  await assertSucceeds(getDocs(query(
    collection(teacherDb, COLLECTIONS.students),
    where("academicYearKey", "==", "2026"),
    where("classKey", "==", "10-A"),
    where("status", "==", "active"),
    orderBy("admissionNo"),
    startAfter(firstPage.docs[0]),
    limit(1)
  )));

  await assertSucceeds(getDocs(query(collection(dbFor(IDS.prefect), COLLECTIONS.late), orderBy("arrivalTime", "desc"))));
  await assertFails(getCountFromServer(collection(dbFor(IDS.account), COLLECTIONS.marks)));
});

test("teacher and admin batches of 1, 20, 100, and 400 writes stay within Rules access-call limits", async () => {
  for (const size of [1, 20, 100, 400]) {
    const teacherDb = dbFor(IDS.teacher);
    const teacherBatch = writeBatch(teacherDb);
    for (let index = 0; index < size; index += 1) {
      const suffix = `teacher-batch-${size}-${index}`;
      teacherBatch.set(doc(teacherDb, COLLECTIONS.marks, suffix), validMark(IDS.teacher, suffix));
    }
    await assertSucceeds(teacherBatch.commit());

    const adminDb = dbFor(IDS.admin);
    const adminBatch = writeBatch(adminDb);
    for (let index = 0; index < size; index += 1) {
      adminBatch.set(doc(adminDb, COLLECTIONS.audit, `admin-batch-${size}-${index}`), { synthetic: true });
    }
    await assertSucceeds(adminBatch.commit());
  }
});
