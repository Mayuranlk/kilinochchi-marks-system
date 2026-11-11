# Website maintenance

In the administrator dashboard, use **Website maintenance**, edit the teacher message, toggle **Enable maintenance mode**, and choose **Save maintenance settings**. Switch it off and save to reopen access. Ask teachers to save their work before enabling: active teacher pages are unmounted, so unsaved edits are lost.

The responsive screen covers signed-in teachers and sectional heads on every application route. Administrators retain access. Login remains available, and the maintenance screen includes sign-out. Existing student-account and prefect-only roles are unaffected. A single listener to `systemSettings/maintenance` updates the screen live and unmounts when the session changes. Teacher pages do not mount until a server response confirms the setting; errors offer retry. A missing document means maintenance is disabled.

The settings document contains `enabled`, `message`, `updatedBy`, and `updatedAt`. Existing systemSettings rules allow academic readers to read and only administrators to write. No rule or database migration is required. This is a website availability gate, not a database security lockdown: it does not revoke API access or cancel writes already in flight. SBA and term marks are unaffected.
