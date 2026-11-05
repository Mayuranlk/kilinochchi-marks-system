# Saivanery display name

The visible English name is Saivanery. The presentation formatter recognizes Hinduism and Saivam, including text loaded from existing documents. It is applied at screen, selector-label, print, PDF and spreadsheet-export boundaries. Searches accept both visible and legacy spellings.

Database collection names, field names, document IDs, canonical religion values, subject codes and report keys (including REL_SAIVAM) are unchanged. Select option values remain original values; only their labels change. Editing another field on an existing subject preserves its stored name. No database migration, record update, security-rule update or automatic duplicate subject creation is performed.

Reports retain the old subject aliases and add Saivanery. Bulk marks imports accept a Saivanery header and resolve it to the existing enrollment and subject ID. Student imports map the new displayed religion name back to the established Hinduism storage value, so exported templates can be imported again. Defaults continue generating the established codes and identities.

The English SBA register uses Saivanery. Existing Tamil labels remain in Tamil. Raw backup/restore data is not rewritten. Identifiers such as REL_HINDUISM may still appear in code/ID fields because they are identifiers, not subject display names.

## Verification

- Full suite: 32 suites / 144 tests passed before the final export-key hardening.
- Final focused export/import tests: 4 suites / 28 tests passed, including dynamic PDF column keys, spreadsheet identifier columns and legacy import mapping.
- Two Chrome workflows passed against isolated emulators: admin search/display and unrelated-edit preservation, and teacher SBA save plus PDF download using the original subject ID.
- Downloaded PDF text contains Saivanery and the saved mark 19, with no Hinduism label.
- Production build passed. Its source map was checked against the final formatter source; no demo project configuration appears in the normal build.
- No production database writes or rule/hosting deployments were performed for this naming change.
