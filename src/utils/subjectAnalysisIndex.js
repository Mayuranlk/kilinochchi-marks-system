export function buildMarksByStudentId(marks = []) {
  const index = new Map();

  marks.forEach((mark) => {
    const studentId = String(mark?.studentId ?? "").trim();
    if (!studentId) return;
    const studentMarks = index.get(studentId);
    if (studentMarks) studentMarks.push(mark);
    else index.set(studentId, [mark]);
  });

  return index;
}
