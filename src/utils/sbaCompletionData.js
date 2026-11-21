// Translate both the original SBA documents and the newer marks-entry format
// to the shape used by the class completion report. Blank drafts are pending.
export function normalizeSbaCompletionMarks(records = [], terms = [], enrollments = []) {
  const termsById = new Map(terms.map((term) => [String(term.id), term]));
  const enrollmentsById = new Map(enrollments.map((row) => [String(row.id), row]));
  const enrollmentsByStudent = new Map();
  enrollments.forEach((row) => {
    const key = String(row.studentId || "");
    const values = enrollmentsByStudent.get(key) || [];
    values.push(row);
    enrollmentsByStudent.set(key, values);
  });
  return records.flatMap((record) => {
    const mark = record.mark ?? record.marks ?? record.score;
    if (record.absent !== true && record.isAbsent !== true &&
        (mark == null || String(mark).trim() === "" || !Number.isFinite(Number(mark)) || Number(mark) < 0 || Number(mark) > 20)) return [];
    const term = termsById.get(String(record.termId || ""));
    const termName = record.termName || record.term || term?.term || term?.termName || term?.name || "";
    const year = record.academicYear || record.year || term?.academicYear || term?.year || "";
    const [grade, section, stream] = String(record.classKey || "").split("|");
    const candidates = enrollmentsByStudent.get(String(record.studentId || "")) || [];
    const enrollment = enrollmentsById.get(String(record.enrollmentId || "")) || candidates.find((row) =>
      String(row.subjectId || "") === String(record.subjectId || "") &&
      String(row.academicYear || row.year || "") === String(year) &&
      (!grade || Number(row.grade) === Number(grade)) &&
      (section === undefined || String(row.section || "").toUpperCase() === section.toUpperCase())
    ) || {};
    return [{ ...enrollment, ...record,
      grade: record.grade || enrollment.grade || grade || "",
      section: record.section ?? enrollment.section ?? section ?? "",
      stream: record.stream || enrollment.stream || stream || "",
      termName, academicYear: year,
      subjectName: record.subjectName || record.subject || enrollment.subjectName || enrollment.subject || "",
      subjectNumber: record.subjectNumber || enrollment.subjectNumber || "",
    }];
  });
}
