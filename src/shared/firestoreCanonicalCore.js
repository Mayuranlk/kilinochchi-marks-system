function text(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function academicYearKey(value) {
  return text(value).match(/\d{4}/)?.[0] || text(value);
}

function gradeNumber(value) {
  const match = text(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function buildCanonicalAcademicFields(row = {}) {
  const year = academicYearKey(row.academicYear ?? row.year);
  const term = slug(row.termId || row.term || row.termName);
  const grade = gradeNumber(row.grade);
  const classIdentity =
    row.classId || row.alClassName || row.fullClassName || row.className ||
    [grade, row.stream, row.section].filter(Boolean).join("-");
  const subjectIdentity =
    row.subjectId || row.subjectNumber || row.subjectCode || row.subjectName || row.subject;
  const assessmentIdentity =
    row.assessmentId || row.practiceExamId ||
    (String(row.assessmentType || "").toLowerCase() === "practice" ? row.assessmentName : "term");

  return {
    schemaVersion: 2,
    academicYearKey: year,
    termKey: term,
    gradeNumber: grade,
    classKey: slug(classIdentity),
    subjectKey: slug(subjectIdentity),
    assessmentKey: slug(assessmentIdentity) || "term",
  };
}

function buildCanonicalStudentFields(row = {}) {
  const academic = buildCanonicalAcademicFields(row);
  return {
    schemaVersion: academic.schemaVersion,
    academicYearKey: academic.academicYearKey,
    gradeNumber: academic.gradeNumber,
    classKey: academic.classKey,
  };
}

function buildCanonicalMarkFields(row = {}) {
  const academic = buildCanonicalAcademicFields(row);
  const studentId = text(row.studentId);
  const markKey = [
    studentId,
    academic.academicYearKey,
    academic.termKey,
    academic.assessmentKey,
    academic.subjectKey,
  ]
    .map((part) => encodeURIComponent(part))
    .join("__");

  return { ...academic, markKey };
}

function buildCanonicalEnrollmentFields(row = {}) {
  const academic = buildCanonicalAcademicFields(row);
  return {
    ...academic,
    enrollmentKey: [text(row.studentId), academic.academicYearKey, academic.subjectKey]
      .map((part) => encodeURIComponent(part))
      .join("__"),
  };
}

module.exports = {
  academicYearKey,
  buildCanonicalAcademicFields,
  buildCanonicalEnrollmentFields,
  buildCanonicalMarkFields,
  buildCanonicalStudentFields,
  gradeNumber,
  slug,
  text,
};
