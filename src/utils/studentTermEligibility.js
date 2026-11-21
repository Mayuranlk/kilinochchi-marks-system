// A student belongs to a term if their school membership overlaps any part of
// that term. Missing dates remain unknown rather than excluding legacy data.
export function schoolDate(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const date = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
    if (!date) return "";
    const parsed = new Date(`${date[0]}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date[0] ? "" : date[0];
  }
  const date = typeof value.toDate === "function" ? value.toDate() : value;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

export function findAcademicTerm(terms = [], year, termName) {
  const name = String(termName || "").trim().toLowerCase();
  if (name === "all" && /^\d{4}$/.test(String(year || ""))) return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  return terms.find((term) => String(term.year || term.academicYear || "") === String(year || "") &&
    String(term.term || term.termName || term.name || "").trim().toLowerCase() === name) || null;
}

export function studentWasEnrolledDuringTerm(student = {}, term = null) {
  if (!term) return true;
  const admitted = schoolDate(student?.joinDate || student?.admissionDate || student?.joinedAt);
  const left = schoolDate(student?.leftDate || student?.leavingDate || student?.dateOfLeaving);
  const start = schoolDate(term.startDate);
  const end = schoolDate(term.endDate);
  if (admitted && end && admitted > end) return false;
  if (left && start && left < start) return false;
  return true;
}
