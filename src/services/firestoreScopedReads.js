import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getScopedRows } from "./firestoreReadCache";

const IN_LIMIT = 30;
const MAX_SCOPE_ROWS = 5000;

const distinct = (values = []) =>
  [...new Map(values.filter((value) => value !== "" && value !== null && value !== undefined)
    .map((value) => [`${typeof value}:${value}`, value])).values()];

export async function loadRowsWhereIn(collectionName, field, values, options = {}) {
  const selected = distinct(values).sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));
  if (!selected.length) return [];

  const rows = [];
  for (let start = 0; start < selected.length; start += IN_LIMIT) {
    const batch = selected.slice(start, start + IN_LIMIT);
    const batchRows = await getScopedRows(
      collectionName,
      ["where-in", field, ...batch],
      () => getDocs(query(
        collection(db, collectionName),
        where(field, "in", batch),
        limit(MAX_SCOPE_ROWS + 1)
      )),
      options
    );
    if (batchRows.length > MAX_SCOPE_ROWS) {
      throw new Error(collectionName + " scope is too large. Narrow the selected grades or year.");
    }
    rows.push(...batchRows);
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export async function loadRowsForGrades(collectionName, grades, options = {}) {
  const numeric = distinct(grades.map(Number).filter(Number.isFinite));
  const strings = numeric.map(String);
  const groups = await Promise.all([
    loadRowsWhereIn(collectionName, "grade", numeric, options),
    loadRowsWhereIn(collectionName, "grade", strings, options),
  ]);
  return [...new Map(groups.flat().map((row) => [row.id, row])).values()];
}
export async function loadRowsForAcademicYear(collectionName, academicYear, options = {}) {
  const year = String(academicYear || "").trim();
  if (!year) return [];
  const values = distinct([
    year,
    Number.isFinite(Number(year)) ? Number(year) : "",
  ]);
  const variants = ["academicYear", "year"].flatMap((field) =>
    values.map((value) => ({ field, value }))
  );
  const read = ({ field, value }) =>
    getScopedRows(
      collectionName,
      ["academic-year", field, value],
      () => getDocs(query(
        collection(db, collectionName),
        where(field, "==", value),
        limit(20001)
      )),
      options
    );

  const primary = await read(variants[0]);
  const rows = primary.length
    ? primary
    : (await Promise.all(variants.slice(1).map(read))).flat();
  if (rows.length > 20000) {
    throw new Error(collectionName + " has more than 20,000 rows for " + year + ". Use a narrower report.");
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}
