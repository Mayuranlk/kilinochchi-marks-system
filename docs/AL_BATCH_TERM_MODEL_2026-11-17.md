# A/L batch and six-term model - 17 November 2026

## Official model

Grades 6 to 11 continue to use three school terms in each calendar year.

A/L classes use the examination year as the permanent batch identity. An intake in 2026 defaults to the 2028 Batch, and an intake in 2027 defaults to the 2029 Batch. Administrators may edit the calculated batch year for an exceptional intake.

A/L class names use:

- 2028 Physical Science A
- 2028 Physical Science B
- 2028 Commerce A
- 2028 Commerce when no section is needed

The class name remains batch-based throughout the course. Terms 1 to 3 are the Grade 12 phase and terms 4 to 6 are the Grade 13 phase.

## Six-term mapping

| A/L term | Internal phase | Calendar position |
| --- | --- | --- |
| 1st Term | Grade 12 | Intake year, school Term 3 |
| 2nd Term | Grade 12 | Intake year + 1, school Term 1 |
| 3rd Term | Grade 12 | Intake year + 1, school Term 2 |
| 4th Term | Grade 13 | Intake year + 1, school Term 3 |
| 5th Term | Grade 13 | Batch year, school Term 1 |
| 6th Term | Grade 13 | Batch year, school Term 2 |

For calendar 2027 school Term 3, the simultaneous active contexts are:

- Grades 6 to 11: 2027 3rd Term
- 2029 A/L Batch: 1st Term
- 2028 A/L Batch: 4th Term

## Stored identity

Academic term documents now use these additive fields:

- termSystem: school or al
- academicScopeKey: school:2027 or al:2028
- termScopeKey: school:2027:T3 or al:2028:T4
- calendarSlotKey: calendar:2027:T3
- termSequence
- calendarYear and calendarTerm
- batchYear and intakeYear for A/L
- phaseGrade for A/L

Classroom, teacher assignment, student, enrollment, term mark, and SBA records carry the batch and academic scope fields. Existing Grade 6 to 11 records remain compatible.

## Administration flow

1. Create the A/L classroom and enter its intake year.
2. Confirm the calculated batch year.
3. Select the stream and optional section.
4. Open Academic Terms and choose Add Term or A/L Batch.
5. Select A/L Batch and create the six terms once.
6. Activate the physical calendar slot. Every school and A/L context mapped to that slot becomes active together.
7. Assign teachers using the exact classroom.
8. Add students by selecting the A/L Batch Class.
9. Teachers see only terms applicable to their assigned class.

## Existing A/L data

Legacy Grade 12 or Grade 13 classrooms continue to load. Their stored year is treated as the batch year until an administrator edits and saves the classroom. Editing a legacy classroom rewrites its official class name with the batch, stream, and section.

Before production release, deploy the updated proposed Firestore rules because new SBA records include the additional batch and calendar metadata.


Sectionless A/L classes retain an empty section through teacher assignments, enrollment generation, SBA and marks entry. SBA queries explicitly include the empty section and retain stream and batch separation.
