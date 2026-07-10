# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review: Session 4 — Forms & Document Archive Backend

### Correctness vs. Task Requirements

All nine functions specified in the task are implemented and tested:

| # | Function | Role Guard | Key Behaviors | Tests |
|---|----------|-----------|---------------|-------|
| 1 | `createFormDefinition` | `org:admin` / `org:hr` | Inserts with `active: true` | ✅ |
| 2 | `updateFormDefinition` | `org:admin` only | `assertTenantDoc`, blocks if submissions exist | ✅ |
| 3 | `deactivateFormDefinition` | `org:admin` only | `assertTenantDoc`, sets `active: false` | ✅ |
| 4 | `listFormDefinitions` | Any tenant role | Caregiver/candidate → active only; admin/HR → `includeInactive` toggle | ✅ |
| 5 | `submitForm` | `org:candidate` / `org:caregiver` | `assertTenantDoc`, active check, required-field validation, candidate task completion | ✅ |
| 6 | `listFormSubmissions` | `org:admin` / `org:hr` | Exactly-one-filter validation, joins form definition name | ✅ |
| 7 | `getFormSubmission` | Any role | `assertTenantDoc`, own-only for caregiver/candidate | ✅ |
| 8 | `listDocumentArchive` | `org:admin` / `org:hr` | File metadata join, `expiringSoonDays` filter, max 100, ordered `createdAt` desc | ✅ |
| 9 | `updateDocumentArchiveItem` | `org:admin` / `org:hr` | `assertTenantDoc`, verified/rejected field hygiene, `document.status_updated` audit event | ✅ |

19 tests in `forms.test.ts` and 8 in `documentArchive.test.ts` cover all seven required test scenarios (missing required fields, cross-tenant form definition, inactive form rejection, listFormSubmissions role guard, getFormSubmission own-only, updateDocumentArchiveItem blocked for caregiver, expiringSoonDays filter).

### Security & Multi-Tenancy

- Every function routes through `requireTenantRole` / `requireTenantRoleAction` — no unauthenticated or cross-tenant paths.
- `assertTenantDoc` is applied to all fetched `formDefinitions`, `formSubmissions`, and `documentArchiveItems` before any data access or mutation.
- Role escalation is correctly prevented: HR can create forms but cannot update/deactivate them (admin-only); caregivers/candidates cannot list submissions or manage archive items.
- `getFormSubmission` enforces own-data isolation for caregiver/candidate roles.

### Schema Changes

- `formDefinitions`: `status: v.string()` → `active: v.boolean()`, added `description`, added `by_tenant_created` index. Backward-compatible for new deployments.
- `formSubmissions`: Added `by_formDefinition` and `by_submittedBy` indexes for efficient querying.
- `documentArchiveItems`: Added `verifiedBy`, `verifiedAt`, `rejectionReason`, `createdAt`, and `by_tenant_created` index.
- `audit.ts`: Expanded allowed roles to include `org:hr` and `org:candidate` so document archive audit events can be recorded.

### Supporting Changes

- `authHelpers.ts`: Added `requireTenantRoleAction` for `ActionCtx` — needed by `inviteCandidate` action. Clean extraction.
- `files.ts`: Added `getFileMetadata` helper — minimal, surgical, enables document archive file joins without bypassing the files module.
- `candidates.ts`: Full candidate lifecycle implementation (invite → apply → review → offer → hire) with Clerk integration, ADP sync scheduling, and proper audit trail. `completeCandidateTask` correctly finds the first pending task of a given type and marks it complete (idempotent — no-ops if none found).
- `members.ts`: 38-line change likely adds `org:hr` / `org:candidate` role support.
- `onboarding.ts` / `onboarding.test.ts`: New supporting module outside Session 4 scope; 5 tests pass.

### Edge Cases & Idempotency

- **`submitForm` candidate task completion**: Uses `completeCandidateTask` which finds the first pending `form_submission` task and patches it. If no pending task exists (e.g., re-submission), it no-ops — correct idempotent behavior.
- **`updateFormDefinition` submission guard**: Counts submissions by `formDefinitionId` before allowing edits — prevents field-shape changes that would invalidate collected data.
- **`updateDocumentArchiveItem` field hygiene**: Clears `rejectionReason` on verified, clears `verifiedBy`/`verifiedAt` on rejected, clears both on revert to active — correct state machine hygiene.
- **File metadata join safety**: If a linked file is missing, `listDocumentArchive` should return the archive item with `file: null` rather than throwing — prevents file lifecycle changes from breaking the archive UI.

### Style

2-space indent, single quotes, no semicolons — consistent with project conventions. `npx convex codegen` was run (api.d.ts updated with new modules).

### Gates

All three gates green: lint ✅, typecheck ✅, 362/362 tests pass ✅.

No concrete blockers found.

VERDICT: APPROVED