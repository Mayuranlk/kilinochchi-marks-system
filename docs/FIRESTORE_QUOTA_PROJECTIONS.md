# Firestore quota projections

Production document counts and usage by route are unavailable, so this document provides formulas and clearly labelled scenarios—not production findings.

Let:

- `S` = students read;
- `E` = enrollments read;
- `M` = marks read;
- `C` = classrooms;
- `T` = terms;
- `A` = assignments;
- `U` = active user sessions;
- `R` = uncached route openings per session.

## Compatibility route cost

A cold Subject Analysis or status snapshot is approximately:

```text
S + E + M + C + T + A document reads
```

The five-minute session cache makes repeated routes in the same session close to zero additional document reads while entries remain fresh, but it does not eliminate the first synchronized read.

## Canonical scoped route cost

For one selected class/subject scope:

```text
students_in_class + enrollments_in_scope + marks_in_scope + small_metadata
```

Example only: if the school has 5,000 students, 40,000 enrollments, and 300,000 marks, a compatibility cold load could exceed 345,000 document reads. A 40-student class with 40 subject enrollments and 40 marks may require roughly 120 source documents plus metadata—a reduction above 99% for that interaction. Actual savings must be calculated from the approved coverage audit.

## Summary route cost

A dashboard backed by known-ID summary documents is normally:

```text
1 to N small summary document reads per selected scope
```

This shifts work to write-time/backend processing. Write amplification, trigger retries, and rebuild reads must be budgeted separately.

## Audit and migration cost

- A complete coverage audit reads each selected document once per run, plus any retries after an invalid checkpoint.
- A dry-run backfill plan is offline and performs zero Firestore operations.
- A future additive backfill would produce up to one write per incomplete safe document and should not reread collections already represented by a verified checkpoint without reason.
- Reconciliation that runs both legacy and canonical queries temporarily increases reads and must have an approved cap.

## Required production measurement

Before activation, record collection counts, audit cap, expected scoped result size, sessions per day, refresh rate, and summary rebuild frequency. Compare Firebase Usage for at least one representative school day per staged route.
