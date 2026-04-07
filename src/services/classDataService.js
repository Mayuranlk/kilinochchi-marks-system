import {
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const DELETE_BATCH_SIZE = 350;

const safeString = (value) => String(value ?? "").trim();

const normalizeGrade = (grade) => safeString(grade);
const normalizeSection = (section) => safeString(section).toUpperCase();
const buildFullClassName = (grade, section) =>
  `${normalizeGrade(grade)}${normalizeSection(section)}`;

const matchesStudentToClass = (student, grade, section) => {
  const normalizedGrade = normalizeGrade(grade);
  const normalizedSection = normalizeSection(section);
  const fullClass = buildFullClassName(grade, section);

  const studentGrade = normalizeGrade(student.grade);
  const studentSection = normalizeSection(student.section);
  const studentClassName = normalizeSection(student.className);

  return (
    (studentGrade === normalizedGrade && studentSection === normalizedSection) ||
    (studentGrade === normalizedGrade && studentClassName === normalizedSection) ||
    studentClassName === fullClass
  );
};

const matchesEnrollmentToClass = (enrollment, grade, section, academicYear = "") => {
  const normalizedGrade = normalizeGrade(grade);
  const normalizedSection = normalizeSection(section);
  const fullClass = buildFullClassName(grade, section);
  const normalizedYear = safeString(academicYear);

  const enrollmentGrade = normalizeGrade(enrollment.grade);
  const enrollmentSection = normalizeSection(enrollment.section);
  const enrollmentClassName = normalizeSection(enrollment.className);
  const enrollmentYear = safeString(enrollment.academicYear);

  const classMatch =
    (enrollmentGrade === normalizedGrade && enrollmentSection === normalizedSection) ||
    enrollmentClassName === fullClass;

  if (!classMatch) return false;
  if (!normalizedYear) return true;

  return enrollmentYear === normalizedYear;
};

const matchesMarkToClass = (
  markDoc,
  grade,
  section,
  academicYear = "",
  studentIdSet = new Set()
) => {
  const normalizedGrade = normalizeGrade(grade);
  const normalizedSection = normalizeSection(section);
  const fullClass = buildFullClassName(grade, section);
  const normalizedYear = safeString(academicYear);

  const markGrade = normalizeGrade(markDoc.grade);
  const markSection = normalizeSection(markDoc.section);
  const markClassName = normalizeSection(markDoc.className);
  const markYear = safeString(markDoc.academicYear || markDoc.year);

  const byStudentId =
    markDoc.studentId && studentIdSet.has(String(markDoc.studentId));

  const byClassFields =
    (markGrade === normalizedGrade && markSection === normalizedSection) ||
    markClassName === fullClass ||
    (markGrade === normalizedGrade && markClassName === normalizedSection);

  if (!(byStudentId || byClassFields)) return false;
  if (!normalizedYear) return true;

  return !markYear || markYear === normalizedYear;
};

const matchesTeacherAssignmentToClass = (assignment, grade, section, academicYear = "") => {
  const fullClass = buildFullClassName(grade, section);
  const normalizedGrade = normalizeGrade(grade);
  const normalizedSection = normalizeSection(section);
  const normalizedYear = safeString(academicYear);

  const assignmentGrade = normalizeGrade(assignment.grade);
  const assignmentSection = normalizeSection(assignment.section);
  const assignmentClassName = normalizeSection(assignment.className);
  const assignmentYear = safeString(assignment.academicYear || assignment.year);

  const classMatch =
    (assignmentGrade === normalizedGrade && assignmentSection === normalizedSection) ||
    assignmentClassName === fullClass;

  if (!classMatch) return false;
  if (!normalizedYear) return true;

  return !assignmentYear || assignmentYear === normalizedYear;
};

const matchesClassroomToClass = (classroom, grade, section, academicYear = "") => {
  const fullClass = buildFullClassName(grade, section);
  const normalizedGrade = normalizeGrade(grade);
  const normalizedSection = normalizeSection(section);
  const normalizedYear = safeString(academicYear);

  const roomGrade = normalizeGrade(classroom.grade);
  const roomSection = normalizeSection(classroom.section);
  const roomClassName = normalizeSection(classroom.className);
  const roomYear = safeString(classroom.academicYear || classroom.year);

  const classMatch =
    (roomGrade === normalizedGrade && roomSection === normalizedSection) ||
    roomClassName === fullClass;

  if (!classMatch) return false;
  if (!normalizedYear) return true;

  return !roomYear || roomYear === normalizedYear;
};

async function chunkDeleteDocs(docRefs = []) {
  if (!docRefs.length) return 0;

  let deletedCount = 0;

  for (let i = 0; i < docRefs.length; i += DELETE_BATCH_SIZE) {
    const chunk = docRefs.slice(i, i + DELETE_BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((docRef) => {
      batch.delete(docRef);
    });

    await batch.commit();
    deletedCount += chunk.length;
  }

  return deletedCount;
}

async function getAllDocs(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({
    id: d.id,
    ref: d.ref,
    ...d.data(),
  }));
}

async function getStudentsForClass({ grade, section, academicYear = "" }) {
  const students = await getAllDocs("students");

  return students.filter((student) => {
    const classMatch = matchesStudentToClass(student, grade, section);
    if (!classMatch) return false;

    if (!academicYear) return true;

    const studentYear = safeString(student.academicYear || student.year);
    return !studentYear || studentYear === safeString(academicYear);
  });
}

async function getEnrollmentsForClass({ grade, section, academicYear = "" }) {
  const enrollments = await getAllDocs("studentSubjectEnrollments");

  return enrollments.filter((enrollment) =>
    matchesEnrollmentToClass(enrollment, grade, section, academicYear)
  );
}

async function getMarksForClass({ grade, section, academicYear = "", studentIds = [] }) {
  const studentIdSet = new Set(studentIds.map((id) => String(id)));
  const marks = await getAllDocs("marks");

  return marks.filter((markDoc) =>
    matchesMarkToClass(markDoc, grade, section, academicYear, studentIdSet)
  );
}

async function getTeacherAssignmentsForClass({ grade, section, academicYear = "" }) {
  const assignments = await getAllDocs("teacherAssignments");

  return assignments.filter((assignment) =>
    matchesTeacherAssignmentToClass(assignment, grade, section, academicYear)
  );
}

async function getClassroomsForClass({ grade, section, academicYear = "" }) {
  const classrooms = await getAllDocs("classrooms");

  return classrooms.filter((room) =>
    matchesClassroomToClass(room, grade, section, academicYear)
  );
}

export async function previewClassData({
  grade,
  section,
  academicYear = "",
  includeTeacherAssignments = true,
  includeClassrooms = true,
}) {
  if (!grade || !section) {
    throw new Error("Grade and section are required.");
  }

  const students = await getStudentsForClass({ grade, section, academicYear });
  const studentIds = students.map((student) => student.id);

  const [enrollments, marks, teacherAssignments, classrooms] = await Promise.all([
    getEnrollmentsForClass({ grade, section, academicYear }),
    getMarksForClass({ grade, section, academicYear, studentIds }),
    includeTeacherAssignments
      ? getTeacherAssignmentsForClass({ grade, section, academicYear })
      : Promise.resolve([]),
    includeClassrooms
      ? getClassroomsForClass({ grade, section, academicYear })
      : Promise.resolve([]),
  ]);

  return {
    className: buildFullClassName(grade, section),
    grade: normalizeGrade(grade),
    section: normalizeSection(section),
    academicYear: safeString(academicYear),
    studentCount: students.length,
    enrollmentCount: enrollments.length,
    marksCount: marks.length,
    teacherAssignmentCount: teacherAssignments.length,
    classroomCount: classrooms.length,
    students,
    enrollments,
    marks,
    teacherAssignments,
    classrooms,
  };
}

async function getStudentRelatedDocs(studentIds = []) {
  const studentIdSet = new Set(studentIds.map((id) => String(id)));

  const [enrollments, marks] = await Promise.all([
    getAllDocs("studentSubjectEnrollments"),
    getAllDocs("marks"),
  ]);

  const matchedEnrollments = enrollments.filter(
    (item) => item.studentId && studentIdSet.has(String(item.studentId))
  );

  const matchedMarks = marks.filter(
    (item) => item.studentId && studentIdSet.has(String(item.studentId))
  );

  return {
    enrollments: matchedEnrollments,
    marks: matchedMarks,
  };
}

export async function deleteStudentsAndRelated({
  studentIds = [],
  performedBy = "",
  reason = "DELETE_SELECTED_STUDENTS",
}) {
  if (!studentIds.length) {
    throw new Error("No students selected for deletion.");
  }

  const allStudents = await getAllDocs("students");
  const studentsToDelete = allStudents.filter((student) => studentIds.includes(student.id));

  if (!studentsToDelete.length) {
    throw new Error("Selected students were not found.");
  }

  const { enrollments, marks } = await getStudentRelatedDocs(studentIds);

  const studentRefs = studentsToDelete.map((item) => item.ref);
  const enrollmentRefs = enrollments.map((item) => item.ref);
  const markRefs = marks.map((item) => item.ref);

  const deletedStudents = await chunkDeleteDocs(studentRefs);
  const deletedEnrollments = await chunkDeleteDocs(enrollmentRefs);
  const deletedMarks = await chunkDeleteDocs(markRefs);

  await addDoc(collection(db, "auditLogs"), {
    action: reason,
    performedBy: safeString(performedBy),
    studentIds,
    deletedStudents,
    deletedEnrollments,
    deletedMarks,
    studentNames: studentsToDelete.map((s) => s.fullName || s.name || ""),
    createdAt: serverTimestamp(),
  });

  return {
    deletedStudents,
    deletedEnrollments,
    deletedMarks,
  };
}

export async function resetClassData({
  grade,
  section,
  academicYear = "",
  removeTeacherAssignments = false,
  removeClassroomMapping = false,
  performedBy = "",
}) {
  const preview = await previewClassData({
    grade,
    section,
    academicYear,
    includeTeacherAssignments: removeTeacherAssignments,
    includeClassrooms: removeClassroomMapping,
  });

  const studentRefs = preview.students.map((item) => item.ref);
  const enrollmentRefs = preview.enrollments.map((item) => item.ref);
  const markRefs = preview.marks.map((item) => item.ref);
  const teacherAssignmentRefs = removeTeacherAssignments
    ? preview.teacherAssignments.map((item) => item.ref)
    : [];
  const classroomRefs = removeClassroomMapping
    ? preview.classrooms.map((item) => item.ref)
    : [];

  const deletedMarks = await chunkDeleteDocs(markRefs);
  const deletedEnrollments = await chunkDeleteDocs(enrollmentRefs);
  const deletedStudents = await chunkDeleteDocs(studentRefs);
  const deletedTeacherAssignments = await chunkDeleteDocs(teacherAssignmentRefs);
  const deletedClassrooms = await chunkDeleteDocs(classroomRefs);

  await addDoc(collection(db, "auditLogs"), {
    action: "RESET_CLASS_DATA",
    performedBy: safeString(performedBy),
    grade: preview.grade,
    section: preview.section,
    className: preview.className,
    academicYear: preview.academicYear,
    deletedStudents,
    deletedEnrollments,
    deletedMarks,
    deletedTeacherAssignments,
    deletedClassrooms,
    createdAt: serverTimestamp(),
  });

  return {
    className: preview.className,
    deletedStudents,
    deletedEnrollments,
    deletedMarks,
    deletedTeacherAssignments,
    deletedClassrooms,
  };
}

export async function getStudentsByClassForSelection({ grade, section, academicYear = "" }) {
  const students = await getStudentsForClass({ grade, section, academicYear });

  return students
    .map((student) => ({
      id: student.id,
      fullName: student.fullName || student.name || "Unnamed Student",
      name: student.name || student.fullName || "Unnamed Student",
      indexNo: student.indexNo || student.admissionNo || student.admissionNumber || "",
      grade: student.grade || "",
      section: student.section || student.className || "",
      className: student.className || "",
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}