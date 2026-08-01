# Summary-document architecture

This is a design only. No summary collection or trigger is active.

## Purpose

Dashboards and completion/status views should eventually read bounded summary documents rather than repeatedly joining marks, enrollments, students, and assignments in the browser.

## Proposed immutable dimensions

A summary identity must include normalized:

- academic year;
- term;
- class;
- subject where applicable;
- assessment;
- schema/calculation version.

Suggested logical paths—not approved persisted names—are one document per class/term/assessment and one per class/term/assessment/subject. Existing collections remain authoritative.

## Example aggregate fields

- expected enrollment count;
- marks saved count;
- absent count;
- missing count;
- appeared count;
- total marks and average inputs;
- last source update timestamp;
- calculation version;
- source watermark or event ID.

Do not store student names, report rows, or mutable role permissions in summary documents.

## Consistency model

- Source marks/enrollments remain authoritative.
- Summary maintenance must be idempotent and event-aware.
- A trusted Firebase backend process should update summaries; clients must not be trusted to write aggregate totals.
- Rebuild jobs must be resumable by academic scope and compare rebuilt totals to source totals before publishing.
- The UI must display summary freshness and fall back to the existing compatible calculation when a summary is missing or its calculation version is unsupported.
- Academic calculations cannot move into summaries until legacy/source output reconciliation proves equivalence.

## Security requirements

- Read access follows the same class/subject/role scope as source reports.
- Client writes are denied.
- Backend identity has only the necessary summary and source-read permissions.
- Summary documents must not broaden access to data a role could not derive from permitted source records.

## Activation gate

No page should consume a summary until the source scope is canonical-ready, Rules are tested, backfill/rebuild output is reconciled, freshness monitoring exists, and rollback to source calculation is verified.
