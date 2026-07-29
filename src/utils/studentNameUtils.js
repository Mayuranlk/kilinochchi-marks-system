const INVISIBLE_NAME_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;

const unicodeLetterOrNumberCount = (value) =>
  Array.from(value).filter((character) => /[\p{L}\p{N}]/u.test(character)).length;

/**
 * Detects the Excel corruption seen in records such as
 * "&&R&A&M&A&N&E&N&T&H&I" without treating ordinary names containing "&"
 * as damaged.
 */
export function hasInterleavedAmpersandCorruption(value) {
  const text = String(value ?? "").trim();
  const ampersandCount = (text.match(/&/g) || []).length;
  if (ampersandCount < 3) return false;

  const letterOrNumberCount = unicodeLetterOrNumberCount(text);
  if (letterOrNumberCount < 4 || ampersandCount / letterOrNumberCount < 0.35) {
    return false;
  }

  const pieces = text
    .split("&")
    .map((piece) => piece.replace(/\s+/g, ""))
    .filter(Boolean);
  if (pieces.length < 4) return false;

  const shortPieces = pieces.filter((piece) => Array.from(piece).length <= 2).length;
  return shortPieces / pieces.length >= 0.65;
}

/**
 * Produces one safe Unicode representation for student names while preserving
 * the original language and letter case.
 */
export function normalizeStudentName(value) {
  let normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE_NAME_CHARACTERS, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (hasInterleavedAmpersandCorruption(normalized)) {
    normalized = normalized.replace(/&/g, "").replace(/\s+/g, " ").trim();
  }

  return normalized;
}

export function studentNameNeedsNormalization(value) {
  return String(value ?? "") !== normalizeStudentName(value);
}
