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

// The caller must supply the complete ordered terms and explicitly confirmed
// old/new memberships. Never derive unknown historical choices from status.
export function planSubjectTermChange({ termIds, effectiveTermId, oldTermIds, newTermIds = [] }) {
  const clean = (value) => String(value ?? "").trim();
  if (!Array.isArray(termIds) || !termIds.length || !Array.isArray(oldTermIds) || !Array.isArray(newTermIds)) {
    throw new Error("Complete ordered terms and confirmed subject history are required.");
  }
  const ordered = termIds.map(clean);
  if (ordered.some((id) => !id) || new Set(ordered).size !== ordered.length) {
    throw new Error("Term identifiers must be nonempty and unique.");
  }
  const effectiveIndex = ordered.indexOf(clean(effectiveTermId));
  if (effectiveIndex < 0) throw new Error("The effective term is not in the academic year.");
  const oldSet = new Set(oldTermIds.map(clean));
  const newSet = new Set(newTermIds.map(clean));
  if ([...oldSet, ...newSet].some((id) => !ordered.includes(id))) {
    throw new Error("Subject history contains an unknown term.");
  }
  if ([...oldSet].some((id) => newSet.has(id))) {
    throw new Error("The old and new subject histories overlap.");
  }
  const oldBefore = ordered.filter((id, index) => index < effectiveIndex && oldSet.has(id));
  const newBefore = ordered.filter((id, index) => index < effectiveIndex && newSet.has(id));
  const later = ordered.slice(effectiveIndex);
  return { oldTermIds: oldBefore, newTermIds: [...newBefore, ...later] };
}
