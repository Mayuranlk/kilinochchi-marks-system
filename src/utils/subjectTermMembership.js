// Explicit membership is authoritative only when a complete term list is
// present. Legacy records have no term history, so callers must retain their
// existing compatibility behavior rather than infer a student's choices.
export function subjectEnrollmentInTerm(enrollment = {}, term = null, termName = "") {
  if (!Array.isArray(enrollment.subjectTermIds)) return null;
  const candidates = [term?.id, term?.termId, term?.term, term?.termName, termName]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (!candidates.length) return null;
  const terms = new Set(enrollment.subjectTermIds.map((value) => String(value ?? "").trim().toLowerCase()).filter(Boolean));
  return candidates.some((value) => terms.has(value));
}
