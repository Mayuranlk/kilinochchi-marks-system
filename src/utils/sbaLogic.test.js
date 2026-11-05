import { buildSbaRegister, buildSbaRoster, parseSbaValue, sbaClassKey, sbaEntryLocked, sbaRecordId } from "./sbaLogic";
import { buildSbaRegisterHtml } from "./sbaRegisterPrint";
import { isSameTeacher } from "./sbaContext";

const term = { id: "term1", academicYear: "2026" };
const assignment = { id: "a1", grade: 10, section: "A", fullClassName: "10A", subjectId: "maths", subjectName: "Mathematics", medium: "Tamil", teacherName: "Teacher" };
const students = [{ id: "s1", name: "Student One", grade: 10, section: "A", fullClassName: "10A", medium: "Tamil" }, { id: "s2", name: "Student Two", grade: 10, section: "A", fullClassName: "10A", medium: "English" }];
const enrollments = students.map((student) => ({ ...student, id: `e-${student.id}`, studentId: student.id, subjectId: "maths", academicYear: "2026", status: "active" }));

test("SBA distinguishes zero, blank, absence, decimals, and invalid marks", () => {
  expect(parseSbaValue("0")).toEqual({ mark: 0, absent: false });
  expect(parseSbaValue("20")).toEqual({ mark: 20, absent: false });
  expect(parseSbaValue("19.5").mark).toBe(19.5);
  expect(parseSbaValue("")).toEqual({ mark: null, absent: false });
  expect(parseSbaValue("", true)).toEqual({ mark: null, absent: true });
  ["21", "-1", "NaN", "Infinity", "0x10", "1e1", "abc"].forEach((value) => expect(() => parseSbaValue(value)).toThrow());
});
test("SBA deadline ends at midnight in Sri Lanka regardless of device timezone", () => {
  const settings = { teacherEntryDeadline: "2026-11-03" };
  expect(sbaEntryLocked(settings, new Date("2026-11-03T18:29:59Z"))).toBe(false);
  expect(sbaEntryLocked(settings, new Date("2026-11-03T18:30:00Z"))).toBe(true);
});
test("SBA roster follows active year/class/subject/medium enrollments and deduplicates students", () => {
  const roster = buildSbaRoster({ assignment, term, students, enrollments: [...enrollments, { ...enrollments[0], id: "duplicate" }, { ...enrollments[0], id: "old", academicYear: "2025" }] });
  expect(roster.map((row) => row.studentId)).toEqual(["s1"]);
  expect(buildSbaRoster({ assignment: { ...assignment, subjectId: "art" }, term, students, enrollments })).toEqual([]);
  expect(buildSbaRoster({ assignment, term, students, enrollments: enrollments.map((row) => ({ ...row, status: "inactive" })) })).toEqual([]);
});
test("A/L streams have distinct SBA scopes and rosters", () => {
  const science = { ...assignment, grade: 12, stream: "Science", fullClassName: "12 Science A" };
  const arts = { ...science, stream: "Arts", fullClassName: "12 Arts A" };
  expect(sbaClassKey(science)).not.toBe(sbaClassKey(arts));
  expect(buildSbaRoster({ assignment: science, term, students, enrollments: [{ ...enrollments[0], ...arts, id: "e1", studentId: "s1" }] })).toEqual([]);
});
test("blank assignment identities never match a teacher with no email", () => {
  expect(isSameTeacher({}, { uid: "teacher" })).toBe(false);
});
test("record identity is deterministic across teacher reassignment, and differs by term and subject", () => {
  expect(sbaRecordId("term1", "s1", "maths")).toBe("term1~s1~maths");
  expect(sbaRecordId("term2", "s1", "maths")).not.toBe(sbaRecordId("term1", "s1", "maths"));
  expect(() => sbaRecordId("term~1", "s1", "maths")).toThrow();
});
test("register combines assigned subjects, preserves zero and absence, and leaves non-enrolled cells blank", () => {
  const register = buildSbaRegister({ assignments: [assignment, { ...assignment, id: "a2", medium: "English" }], term, students, enrollments, records: [
    { id: "term1~s1~maths", mark: 0, absent: false }, { id: "term1~s2~maths", mark: null, absent: true },
  ] });
  expect(register.columns).toHaveLength(1);
  expect(register.rows.map((row) => row.values.maths)).toEqual([0, "AB"]);
});
test("A3 printing escapes names, uses English headings, and paginates 35 students and at most 22 subjects", () => {
  const register = { columns: Array.from({ length: 23 }, (_, index) => ({ id: `sub${index}`, name: index ? `Subject ${index}` : "Mathematics", teachers: "Teacher <One>" })), rows: Array.from({ length: 36 }, (_, index) => ({ studentName: `Student ${index} <script>`, values: { sub0: 0 } })) };
  const html = buildSbaRegisterHtml({ register, classLabel: "10A", year: "2026", termName: "Term 1", fontUrl: "/fonts/NotoSansTamil.ttf" });
  expect(html.match(/<section class="sheet">/g)).toHaveLength(4);
  expect(html).toContain("size:A3 landscape");
  expect(html).toContain("Mathematics");
  expect(html).toContain("Grey = Not enrolled");
  expect(html).not.toMatch(/[\u0B80-\u0BFF]/);
  expect(html).toContain("Student 35 &lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain(">0</td>");
});
