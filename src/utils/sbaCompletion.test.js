import { getSbaCompletion } from "./sbaCompletion";
import { normalizeMarksEntrySettings } from "./marksEntryAccess";
const term = { id: "t1", year: "2026" };
const context = { grade: 6, section: "A" };
const rows = [{ studentId: "s1", subjectId: "maths" }, { studentId: "s2", subjectId: "maths" }];
const records = rows.map((row) => ({ id: `t1~${row.studentId}~maths`, year: "2026", classKey: "6|A|", mark: 0, absent: false }));
test("prerequisite defaults off and persists explicit admin choice", () => {
  expect(normalizeMarksEntrySettings({}).requireSbaCompletion).toBe(false);
  expect(normalizeMarksEntrySettings({ requireSbaCompletion: true }).requireSbaCompletion).toBe(true);
});
test("all students must have saved SBA; zero and absent count, pending does not", () => {
  expect(getSbaCompletion(rows, records, term, context).complete).toBe(true);
  expect(getSbaCompletion(rows, [records[0]], term, context).pending).toBe(1);
  expect(getSbaCompletion(rows, [records[0], { ...records[1], mark: null, absent: true }], term, context).complete).toBe(true);
  expect(getSbaCompletion(rows, [records[0], { ...records[1], mark: null }], term, context).complete).toBe(false);
});
test("wrong term, year, class, subject and invalid values cannot unlock entry", () => {
  for (const patch of [{ id: "t2~s2~maths" }, { year: "2025" }, { classKey: "6|B|" }, { id: "t1~s2~art" }, { mark: 21 }, { mark: "0" }, { absent: true, mark: 10 }]) {
    expect(getSbaCompletion(rows, [records[0], { ...records[1], ...patch }], term, context).complete).toBe(false);
  }
  expect(getSbaCompletion([], [], term, context).complete).toBe(false);
});
