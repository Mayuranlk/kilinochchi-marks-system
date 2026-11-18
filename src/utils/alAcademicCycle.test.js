import {
  buildALBatchClassName,
  deriveALBatchYear,
  getALTermSchedule,
  getAcademicTermLabel,
  termAppliesToClass,
} from "./alAcademicCycle";

test("derives the official A/L batch year and class name", () => {
  expect(deriveALBatchYear(2026)).toBe(2028);
  expect(buildALBatchClassName(2028, "Physical Science", "A")).toBe(
    "2028 Physical Science A"
  );
  expect(buildALBatchClassName(2028, "Commerce", "")).toBe("2028 Commerce");
});

test("maps the 2028 batch across six terms and two grade phases", () => {
  const schedule = getALTermSchedule({ intakeYear: 2026, batchYear: 2028 });

  expect(
    schedule.map(({ termSequence, calendarYear, calendarTerm, phaseGrade }) => [
      termSequence,
      calendarYear,
      calendarTerm,
      phaseGrade,
    ])
  ).toEqual([
    [1, 2026, 3, 12],
    [2, 2027, 1, 12],
    [3, 2027, 2, 12],
    [4, 2027, 3, 13],
    [5, 2028, 1, 13],
    [6, 2028, 2, 13],
  ]);

  expect(getAcademicTermLabel(schedule[3])).toBe("2028 Batch - 4th Term");
});

test("keeps simultaneous A/L batches separate in the same calendar slot", () => {
  const batch2028 = getALTermSchedule({ batchYear: 2028 })[3];
  const batch2029 = getALTermSchedule({ batchYear: 2029 })[0];

  expect(batch2028.calendarSlotKey).toBe("calendar:2027:T3");
  expect(batch2029.calendarSlotKey).toBe("calendar:2027:T3");
  expect(batch2028.termScopeKey).toBe("al:2028:T4");
  expect(batch2029.termScopeKey).toBe("al:2029:T1");
  expect(termAppliesToClass(batch2028, { grade: 13, batchYear: 2028 })).toBe(true);
  expect(termAppliesToClass(batch2028, { grade: 12, batchYear: 2029 })).toBe(false);
});

