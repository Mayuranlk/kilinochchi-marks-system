export function isValidSbaMark(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return false;
  const mark = Number(text);
  return Number.isFinite(mark) && mark >= 0 && mark <= 20;
}

export function sbaRecordId(termId, studentId, subjectId) {
  const parts = [termId, studentId, subjectId];
  if (parts.some((value) => typeof value !== "string" || !value || /[~/]/.test(value))) {
    throw new Error("SBA requires a valid term, student and subject ID.");
  }
  return parts.join("~");
}

export function matchesSbaRecord(record, termId, studentId, subjectId) {
  return Boolean(record?.termId) && String(record.termId) === String(termId) &&
    String(record.studentId || "") === String(studentId) &&
    String(record.subjectId || "") === String(subjectId);
}

// Matches the class key used by the deployed term-mark SBA prerequisite.
export function sbaClassKey(grade, section, stream, batchYear) {
  const gradeNumber = Number(grade);
  const base = `${gradeNumber}|${String(section || "").toUpperCase()}|${gradeNumber >= 12 ? String(stream || "").toLowerCase() : ""}`;
  const batch = Number(batchYear) || 0;
  return gradeNumber >= 12 && batch > 0 ? `${base}|${batch}` : base;
}
