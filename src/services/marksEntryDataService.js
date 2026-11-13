import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getScopedRows } from "./firestoreReadCache";

const FIRESTORE_IN_LIMIT = 30;
const MAX_MARK_HISTORY_PER_BATCH = 2500;

const uniqueIds = (values = []) =>
  [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();

const distinctValues = (values) =>
  [...new Map(values.filter((value) => value !== "" && value !== null && value !== undefined)
    .map((value) => [`${typeof value}:${value}`, value])).values()];

const readStudentHistoryBatch = (batch, options) =>
  getScopedRows(
    "marks",
    ["term-entry-students-fallback", ...batch],
    () =>
      getDocs(
        query(
          collection(db, "marks"),
          where("studentId", "in", batch),
          limit(MAX_MARK_HISTORY_PER_BATCH + 1)
        )
      ),
    options
  );

// Current and legacy marks use academicYear/year with string or numeric values.
// Equality-scoped reads usually return only the selected subject's few terms.
// If production is missing the needed merged index, the bounded student-history
// query keeps the page working without reverting to a school-wide scan.
async function readScopedBatch(batch, scope, options) {
  const academicYear = String(scope.academicYear || "").trim();
  const subjectId = String(scope.subjectId || "").trim();
  if (!academicYear) return readStudentHistoryBatch(batch, options);

  const yearValues = distinctValues([
    academicYear,
    Number.isFinite(Number(academicYear)) ? Number(academicYear) : "",
  ]);

  const variants = ["academicYear", "year"].flatMap((yearField) =>
    yearValues.map((yearValue) => ({ yearField, yearValue }))
  );
  const readVariant = ({ yearField, yearValue }) =>
    getScopedRows(
      "marks",
      ["term-entry-scope", ...batch, yearField, yearValue, subjectId],
      () =>
        getDocs(
          query(
            collection(db, "marks"),
            where("studentId", "in", batch),
            where(yearField, "==", yearValue),
            ...(subjectId ? [where("subjectId", "==", subjectId)] : []),
            limit(MAX_MARK_HISTORY_PER_BATCH + 1)
          )
        ),
      options
    );

  try {
    const primary = await readVariant(variants[0]);
    if (primary.length) return primary;
    const fallbacks = await Promise.all(variants.slice(1).map(readVariant));
    return fallbacks.flat();
  } catch (error) {
    if (error?.code !== "failed-precondition") throw error;
    return readStudentHistoryBatch(batch, options);
  }
}

// Query by the selected roster's student IDs and selected academic scope. This
// preserves legacy term records while preventing a marks collection scan.
export async function loadMarksForStudents(studentIds, scope = {}, options = {}) {
  const ids = uniqueIds(studentIds);
  if (!ids.length) return [];

  const rows = [];
  for (let start = 0; start < ids.length; start += FIRESTORE_IN_LIMIT) {
    const batch = ids.slice(start, start + FIRESTORE_IN_LIMIT);
    const batchRows = await readScopedBatch(batch, scope, options);
    if (batchRows.length > MAX_MARK_HISTORY_PER_BATCH) {
      throw new Error(
        "The selected students have too many historical mark records. Ask an administrator to check duplicate marks."
      );
    }
    rows.push(...batchRows);
  }

  return [...new Map(rows.map((row) => [row.id, row])).values()];
}