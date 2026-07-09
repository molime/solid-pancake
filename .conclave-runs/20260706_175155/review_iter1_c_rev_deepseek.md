# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of Code Change

### What the diff does well

- **Convex integration tests for candidate lifecycle** (`convex/onboarding.test.ts`): Adds tests for `inviteCandidate` seeding 5 tasks, full lifecycle from invited to hired, idempotent `acceptOffer`, and role guard `org:candidate` cannot `listShifts`. ✅ AC-4 satisfied.
- **Scheduling integration tests** (`convex/scheduling.test.ts`): Adds tests for non-caregiver `assignedCaregiver` rejection, same-caregiver overlap conflict, and `shift.created` audit event. ✅ Part of AC-5.
- **Document archive integration test** (`convex/documentArchive.test.ts`): Adds a `pending_review` fixture test that verifies `updateDocumentArchiveItem` sets `verifiedBy`/`verifiedAt` and records an audit event. ✅ Part of AC-6.
- **Seed fixtures** (`convex/seed.ts`): Adds idempotent Phase 2 fixtures: candidate in `hr_review` with application and completed tasks, recurring availability window, open coverage request, 3-field form definition, and two pending-review document archive items. ✅ AC-7 satisfied.
- **Seed test** (`convex/seed.test.ts`): Adds idempotency test for Phase 2 fixtures. ✅
- **Frontend scaffolding**: Adds routes, shell changes, mock data, and harness views to support the new pages. These are necessary for E2E but not directly required by the ACs.

### Missed Acceptance Criteria

#### 1. Playwright E2E specs are completely absent
The diff contains **no new files** under `tests/e2e/`. The task requires:
- `tests/e2e/onboarding.spec.ts` (AC-1)
- `tests/e2e/scheduling.spec.ts` (AC-2)
- `tests/e2e/documents.spec.ts` (AC-3)

These are the core deliverables of the task. Without them, the E2E portion is entirely missing.

#### 2. Missing integration tests for scheduling (AC-5)
The diff does **not** add tests for:
- `updateShift` blocked when shift status is `submitted`
- `deleteShift` blocked when shift status is `in_progress`
- `requestCoverage` rejected when called by a caregiver who is not the shift’s assigned caregiver

These are explicitly listed in the task. The original `scheduling.test.ts` may have some, but the diff does not add them, and the task says to implement them.

#### 3. Missing integration tests for forms (AC-6)
The diff does **not** add tests for:
- `submitForm` rejecting submission when required fields are missing
- `submitForm` rejecting submission when the form definition is inactive

The diff only updates sample fields and test data. The original `forms.test.ts` may have these, but the task requires them to be implemented as part of this change.

#### 4. Missing role guard test for document archive (AC-6)
The diff does **not** add a test that `org:caregiver` cannot call `updateDocumentArchiveItem`. The original `documentArchive.test.ts` may have one, but the task explicitly requires it.

### Security / PHI / Money / Idempotency Issues

- **Idempotency**: The seed functions correctly delete-then-recreate, and the candidate member role reset is handled. No additive-write races found.
- **PHI**: The new `getFormDefinition` query allows `org:candidate` to read form definitions, which is appropriate. No PHI exposure.
- **Audit**: `createShift` and `updateDocumentArchiveItem` now record audit events. Good.
- **Role guards**: All new mutations/queries use `requireTenantRole` with appropriate roles. No bypasses.

### Concrete Changes Requested

1. **Create the three Playwright E2E spec files** as specified in the task:
   - `tests/e2e/onboarding.spec.ts` (full candidate-to-caregiver flow with training mock)
   - `tests/e2e/scheduling.spec.ts` (admin shift creation, conflict, availability, coverage)
   - `tests/e2e/documents.spec.ts` (document verify/reject, expiring soon filter)

2. **Add missing integration tests** to `convex/scheduling.test.ts`:
   - `updateShift` blocked on `submitted` status
   - `deleteShift` blocked on `in_progress` status
   - `requestCoverage` rejected for wrong caregiver

3. **Add missing integration tests** to `convex/forms.test.ts`:
   - `submitForm` rejects missing required fields
   - `submitForm` rejects inactive form definition

4. **Add missing role guard test** to `convex/documentArchive.test.ts`:
   - `org:caregiver` cannot call `updateDocumentArchiveItem`

These are concrete blockers because the task explicitly requires them and they are absent from the diff.

VERDICT: CHANGES_REQUESTED