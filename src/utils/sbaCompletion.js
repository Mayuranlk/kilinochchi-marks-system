import { sbaClassKey, sbaRecordId, sbaYear } from "./sbaLogic";

export function getSbaCompletion(rows, records, term, classContext) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const pending = rows.filter((row) => {
    if (!term?.id || !row.subjectId || !row.studentId) return true;
    const record = byId.get(sbaRecordId(term.id, row.studentId, row.subjectId));
    return !record || record.year !== sbaYear(term) || record.classKey !== sbaClassKey(classContext) ||
      !((record.absent === true && record.mark === null) ||
        (record.absent === false && typeof record.mark === "number" && Number.isFinite(record.mark) && record.mark >= 0 && record.mark <= 20));
  });
  return { total: rows.length, pending: pending.length, complete: rows.length > 0 && pending.length === 0 };
}
