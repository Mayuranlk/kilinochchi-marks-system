# Firestore authorization and access matrix

## Verified deployed behavior

SHA-256 of `firestore.rules.deployed.review`:

```text
04F9ECED7836F7CA4266BBF91A843A9BDE63698E28F40BFA6414CE46D111C57E
```

SHA-256 of the current undeployed `firestore.rules.proposed.review`:

```text
EB6518F273C2F037BE80AAD8A65E53043893EDA09587C6E442BFFE9623FFE969
```

The deployed wildcard grants every authenticated Firebase user `read` and `write` on every document path. In Rules terminology, `write` includes create, update, and delete. Roles, route guards, assignments, profile flags, document ownership, mark ranges, and field validation have no effect on backend authorization.

| Principal | Every Firestore path |
| --- | --- |
| Unauthenticated | Denied |
| Authenticated with missing/unknown application role | Read, create, update, delete |
| Admin | Read, create, update, delete |
| Teacher / subject teacher | Read, create, update, delete |
| IT teacher | Read, create, update, delete |
| Sectional head | Read, create, update, delete |
| Account | Read, create, update, delete |
| Prefect | Read, create, update, delete |

Consequences are critical: any authenticated user can modify their own or another `users` role, tamper with marks and reports, read all student/staff/account data, delete academic history, modify elections and fee accounts, alter system settings, and overwrite audit records. React route guards are presentation controls and cannot mitigate direct SDK/REST access.

## Source-backed application roles

`AuthContext` recognizes:

- `admin`;
- `teacher` and `isSubjectTeacher` capability;
- `it_teacher`, `isITTeacher`, or `canAccessAllReports` capability;
- `sectional_head` or `isSectionalHead` capability;
- `account`;
- `prefect` or `isPrefect` capability.

An authenticated account with no recognized role still needs to read its own `users/{uid}` profile so the application can determine that it has no authorized workspace.

## Proposed interim compatibility matrix

Legend: `R` = get/list, `G` = own profile get only, `C/U` = create/update, `D` = delete, `—` = denied. Admin `R/C/U/D` also preserves the existing client-side backup/restore workflow.

| Collection | Unknown authenticated | Admin | Teacher / subject teacher | IT teacher | Sectional head | Account | Prefect |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `users` | G | R/C/U/D | R | R | R | G | G |
| `students` | — | R/C/U/D | R | R | R | R | R |
| `subjects` | — | R/C/U/D | R | R | R | — | — |
| `classrooms` | — | R/C/U/D | R | R | R | — | — |
| `academicTerms` | — | R/C/U/D | R | R | R | — | — |
| `practiceExams` | — | R/C/U/D | R | R | R | — | — |
| `teacherAssignments` | — | R/C/U/D | R | R | R | — | — |
| `studentSubjectEnrollments` | — | R/C/U/D | R | R | R | — | — |
| `marks` | — | R/C/U/D | R/C/U validated | R/C/U validated | R | — | — |
| `systemSettings` | — | R/C/U/D | R | R | R | — | — |
| `studentFeeAccounts` | — | R/C/U/D | — | — | — | R/C/U | — |
| `lateArrivalRecords` | — | R/C/U/D | — | — | — | — | R/C/U constrained |
| `elections` | R | R/C/U/D | R | R | R | R | R |
| `auditLogs` | — | R/C/U/D | — | — | — | — | — |
| `classShufflePlans` | — | R/C/U/D | — | — | — | — | — |
| `promotionHistory` | — | R/C/U/D | — | — | — | — | — |
| `teachers` legacy collection | — | R/C/U/D | — | — | — | — | — |
| Any unmatched path | — | — | — | — | — | — | — |

## Query compatibility constraints

The interim proposal intentionally permits broad academic reads because current teacher, sectional-head, report, Marks Entry, and analysis routes still issue whole-collection compatibility queries. Firestore Rules are not filters: restricting reads to assignment scope before the frontend sends equivalent `where` constraints would make the whole query fail.

The following cannot yet be enforced without breaking current routes:

- teacher reads limited to assigned classes/subjects;
- sectional-head reads limited to assigned grades;
- users list reduced to non-sensitive teacher fields;
- per-class marks/enrollment query limits.

These controls remain gated on canonical reconciliation, scoped repositories, a query-compatible authorization model, and emulator tests.

## Proposed mark controls

Non-admin mark writes require:

- a recognized subject-teacher capability;
- `teacherId == request.auth.uid`;
- canonical schema version and query keys;
- nonblank student/year/term/class/subject/assessment/logical identity;
- matching `mark`, `marks`, and `score` aliases;
- matching `absent` and `isAbsent` aliases;
- mark null for absent, otherwise null or numeric 0–100;
- optional attendance null or numeric 0–100;
- unchanged student identity on update;
- unchanged logical `markKey` after it already exists.

Admin bypass remains necessary for legacy correction and the existing backup/restore workflow. Generated mark document IDs remain unchanged.

## Residual risks before final least privilege

- Academic staff still read broad academic collections and the complete users list because current queries require it.
- A subject teacher can write a structurally valid mark outside an assigned class/subject because assignments lack a deterministic authorization document usable by Rules.
- Profile-based roles require a Rules `get()`/`exists()` dependency, which must be load-tested for batched writes and read billing.
- Client-side admin backup/restore requires broad admin writes, including audit-history replacement.
- `/election-live` and `/marks-status-live` are unguarded React routes, but the verified deployed Rules require authentication. The proposed rules preserve that deployed behavior rather than opening data publicly.
- The proposed file must not be deployed until compilation and role/query emulator tests pass.
