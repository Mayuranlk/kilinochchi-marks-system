import {
  COMPULSORY_CORE_6_9,
  COMPULSORY_CORE_10_11,
  getALCompulsorySubjectsForStream,
} from "../constants";

export const text = (value) => String(value ?? "").trim();
export const lower = (value) => text(value).toLowerCase();
export const loose = (value) =>
  lower(value).normalize("NFKC").replace(/[^a-z0-9]+/g, "");
export const gradeOf = (value) => Number(String(value ?? "").match(/\d+/)?.[0] || 0);
export const yearOf = (value, fallback = "") =>
  String(value ?? "").match(/\d{4}/)?.[0] || fallback;
export const isActive = (value) => ["", "active", "current"].includes(lower(value));
export const studentNameOf = (student) =>
  text(student?.name || student?.fullName) || "Unnamed student";
export const studentIndexOf = (student) =>
  text(student?.admissionNo || student?.indexNo || student?.emisStudentId);
export const classOf = (item) => {
  if (text(item?.alClassName || item?.fullClassName)) {
    return text(item.alClassName || item.fullClassName);
  }
  const grade = gradeOf(item?.grade);
  const section = text(item?.section || item?.className).toUpperCase();
  return grade && section ? `${grade}${section.replace(/^\d+/, "")}` : section;
};
export const subjectNameOf = (item) =>
  text(item?.subjectName || item?.subject || item?.name || item?.shortName);
export const subjectIdentity = (item) => {
  const number = text(item?.subjectNumber || item?.subjectNo);
  if (number) return `number:${loose(number)}`;
  const name = subjectNameOf(item);
  if (name) return `name:${loose(name)}`;
  return `id:${lower(item?.subjectId || item?.id)}`;
};

export function expectedCompulsorySubjects(student) {
  const grade = gradeOf(student?.grade);
  if (grade >= 6 && grade <= 9) return [...COMPULSORY_CORE_6_9];
  if (grade >= 10 && grade <= 11) return [...COMPULSORY_CORE_10_11];
  if (grade >= 12 && grade <= 13) {
    return getALCompulsorySubjectsForStream(student?.stream)
      .map((subject) => subject.subjectName)
      .filter(Boolean);
  }
  return [];
}

export function buildAcademicHealthReport({
  students = [],
  subjects = [],
  enrollments = [],
  marks = [],
  academicYear,
}) {
  const issues = [];
  const activeStudents = students.filter((student) => isActive(student.status || "active"));
  const studentMap = new Map(students.map((student) => [text(student.id), student]));
  const subjectMap = new Map(subjects.map((subject) => [text(subject.id), subject]));
  const targetEnrollments = enrollments.filter((enrollment) =>
    isActive(enrollment.status || "active") &&
    yearOf(enrollment.academicYear || enrollment.year, academicYear) === academicYear
  );

  const add = (issue) => issues.push({
    severity: "warning",
    student: "",
    indexNo: "",
    className: "",
    ...issue,
  });

  const indexGroups = new Map();
  activeStudents.forEach((student) => {
    const index = lower(studentIndexOf(student));
    if (!index) {
      add({
        severity: "error", type: "Missing student index",
        student: studentNameOf(student), className: classOf(student),
        detail: "Active student has no admission/index number.",
      });
      return;
    }
    if (!indexGroups.has(index)) indexGroups.set(index, []);
    indexGroups.get(index).push(student);
  });
  indexGroups.forEach((group, index) => {
    if (group.length < 2) return;
    group.forEach((student) => add({
      severity: "error", type: "Duplicate student index",
      student: studentNameOf(student), indexNo: index, className: classOf(student),
      detail: `${group.length} active students use this index number.`,
    }));
  });

  const subjectGroups = new Map();
  subjects.filter((subject) => isActive(subject.status || "active")).forEach((subject) => {
    const key = `${lower(subject.category)}:${subjectIdentity(subject)}`;
    if (!subjectGroups.has(key)) subjectGroups.set(key, []);
    subjectGroups.get(key).push(subject);
  });
  subjectGroups.forEach((group) => {
    if (group.length < 2) return;
    add({
      type: "Duplicate subject definition",
      detail: `${subjectNameOf(group[0])} has ${group.length} active subject documents.`,
    });
  });

  const enrollmentGroups = new Map();
  targetEnrollments.forEach((enrollment) => {
    const student = studentMap.get(text(enrollment.studentId));
    const subject = subjectMap.get(text(enrollment.subjectId));
    if (!student) {
      add({
        severity: "error", type: "Orphan enrollment",
        detail: `Enrollment ${enrollment.id} refers to a missing student.`,
      });
    }
    if (enrollment.subjectId && !subject) {
      add({
        type: "Missing subject reference",
        student: student ? studentNameOf(student) : text(enrollment.studentName),
        indexNo: student ? studentIndexOf(student) : text(enrollment.admissionNo),
        className: student ? classOf(student) : classOf(enrollment),
        detail: `${subjectNameOf(enrollment) || enrollment.subjectId} refers to a missing subject document.`,
      });
    }
    const key = `${text(enrollment.studentId)}:${subjectIdentity(enrollment)}`;
    if (!enrollmentGroups.has(key)) enrollmentGroups.set(key, []);
    enrollmentGroups.get(key).push(enrollment);
  });
  enrollmentGroups.forEach((group) => {
    if (group.length < 2) return;
    const student = studentMap.get(text(group[0].studentId));
    add({
      type: "Duplicate enrollment",
      student: student ? studentNameOf(student) : text(group[0].studentName),
      indexNo: student ? studentIndexOf(student) : text(group[0].admissionNo),
      className: student ? classOf(student) : classOf(group[0]),
      detail: `${subjectNameOf(group[0])} appears ${group.length} times in ${academicYear}.`,
    });
  });

  const enrollmentsByStudent = new Map();
  targetEnrollments.forEach((enrollment) => {
    if (!enrollmentsByStudent.has(enrollment.studentId)) {
      enrollmentsByStudent.set(enrollment.studentId, new Set());
    }
    enrollmentsByStudent.get(enrollment.studentId).add(subjectIdentity(enrollment));
  });
  activeStudents.forEach((student) => {
    const enrolled = enrollmentsByStudent.get(student.id) || new Set();
    expectedCompulsorySubjects(student).forEach((name) => {
      if (enrolled.has(subjectIdentity({ subjectName: name }))) return;
      add({
        severity: "error", type: "Missing compulsory enrollment",
        student: studentNameOf(student), indexNo: studentIndexOf(student),
        className: classOf(student),
        detail: `${name} is missing for ${academicYear}.`,
      });
    });
  });

  const enrollmentKeys = new Set(targetEnrollments.map((enrollment) =>
    `${text(enrollment.studentId)}:${subjectIdentity(enrollment)}`
  ));
  marks.filter((mark) =>
    yearOf(mark.academicYear || mark.year, academicYear) === academicYear
  ).forEach((mark) => {
    if (!studentMap.has(text(mark.studentId))) {
      add({
        severity: "error", type: "Orphan mark",
        detail: `Mark ${mark.id} refers to a missing student.`,
      });
      return;
    }
    if (!enrollmentKeys.has(`${text(mark.studentId)}:${subjectIdentity(mark)}`)) {
      const student = studentMap.get(text(mark.studentId));
      add({
        type: "Mark without enrollment", student: studentNameOf(student),
        indexNo: studentIndexOf(student), className: classOf(student),
        detail: `${subjectNameOf(mark) || "Unknown subject"} has marks but no active ${academicYear} enrollment.`,
      });
    }
  });

  const byType = issues.reduce((result, issue) => {
    result[issue.type] = (result[issue.type] || 0) + 1;
    return result;
  }, {});
  return {
    issues,
    byType,
    totals: {
      students: activeStudents.length,
      subjects: subjects.filter((subject) => isActive(subject.status || "active")).length,
      enrollments: targetEnrollments.length,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
    },
  };
}
