# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

## Review

The diff implements most of the Phase 2 integration/E2E work correctly and the unit/type/lint gates are green. Specific positives:

- **`convex/seed.ts`** — `deleteFixtureCaregiverShifts` now matches shifts by both Clerk user id and Convex `tenantMembers._id`, and also wipes future shifts in the E2E tenant, which fixes the stale-shift conflict called out in AC-1 (new block around lines 568–640). Phase 2 fixtures are idempotent: `seedPhase2Candidate`, `seedPhase2AvailabilityWindow`, `seedPhase2CoverageRequest`, `seedPhase2FormDefinition`, and `seedPhase2DocumentArchiveItems` all look up existing rows before inserting (around lines 887–1180).
- **`convex/onboarding.test.ts`** — adds the lifecycle block that asserts `form_submission` is `complete` after `submitApplication` and that `hireCandidate` creates an `employeeProfiles` row with `adpSyncStatus === 'pending_credentials'` (around lines 362–590).
- **`convex/scheduling.test.ts`** — adds the direct `checkShiftConflict` `excludeShiftId` test (around lines 323–360) and the cross-caregiver overlap test (around lines 400–500).
- **`convex/forms.test.ts`** — adds the multiple missing required fields assertion and thin wrappers for `api.documentArchive.updateDocumentArchiveItem` (around lines 530–560 and 873–925).
- **`convex/forms.ts`** — validation now collects all missing required field ids and throws `Missing required fields: …` (around lines 220–235).
- **`convex/documentArchive.test.ts`** — adds the `pending_review` fixture verification test (around lines 366–420).

### Blockers / things I cannot verify

1. **AC-1 — `tests/e2e/scheduling.spec.ts` is not in the portion of the diff shown.** The diff is truncated at 60 000 chars and the visible hunks stop before that file. I cannot confirm the “Send request” button is scrolled/forced, or that the stale-shift cleanup is actually exercised by the E2E spec. Please provide the `scheduling.spec.ts` hunk and the real `npm run e2e` result.

2. **AC-6 — E2E and build gate results are missing.** The “LATEST REAL GATE RESULTS” excerpt only shows `lint`, `typecheck`, and `unit`. The task explicitly requires `npm run e2e` and `npm run build` with reported pass/fail counts. I need those outputs before approving.

3. **`convex/files.ts` line 42** adds `'org:candidate'` to `generateUploadUrl`. Confirm this is intentional for candidate document upload and that the follow-up file-linking mutation enforces tenant/candidate ownership so candidates cannot attach files to other subjects.

4. **`convex/forms.ts` `getFormDefinition`** now allows `org:candidate` (around line 353). That’s fine for reading an onboarding form, but verify it does not expose internal/admin-only forms to candidates.

5. **`convex/candidates.ts` `updateClerkMembershipRole`** changed its return shape from `{ updated: true }` to `{ updated, membershipId }` and returns `membershipId: null` when no membership exists (around lines 158–210). Ensure all internal callers handle the new shape and the null case, otherwise a retry/redelivery could silently skip role promotion.

6. **`convex/seed.ts` `deleteFixtureCaregiverShifts`** deletes **all** future shifts in the tenant, not just fixture-caregiver shifts (around lines 620–640). This is safe only if the E2E tenant is strictly isolated from production data. Please confirm that invariant holds.

7. The `submitForm` error message changed from singular to plural. If any E2E or frontend assertion still expects `Missing required field:`, it will fail. Re-run E2E to confirm.

### Requested next step

Re-run `npm run e2e` and `npm run build`, paste the full pass/fail counts, and include the `tests/e2e/scheduling.spec.ts` diff if it was changed. Once those are green and the above points are confirmed, this is ready to approve.

VERDICT: CHANGES_REQUESTED