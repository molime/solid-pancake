# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of Code Change

### Acceptance Criteria Check

| AC | Status | Notes |
|---|---|---|
| **AC-1** (scheduling.spec.ts passes) | ❌ **Not met** | The E2E spec `tests/e2e/scheduling.spec.ts` is **not modified** in the diff. The stale-shift cleanup is addressed in `convex/seed.ts`, but the required scroll-into-view / force-click fix for the "Send request" button is missing. The plan explicitly requires this change. |
| **AC-2** (onboarding.test.ts lifecycle assertions) | ✅ Met | New `candidate lifecycle` describe block in `convex/onboarding.test.ts` checks `form_submission` task completion after `submitApplication` and `adpSyncStatus: 'pending_credentials'` after `hireCandidate`. |
| **AC-3** (scheduling.test.ts cross-caregiver + excludeShiftId) | ✅ Met | Tests `allows overlapping shifts for different caregivers` and `checkShiftConflict returns null when excluding the only shift` added. |
| **AC-4** (forms.test.ts multiple missing fields) | ✅ Met | Test `throws when multiple required fields are missing and lists them` added; `convex/forms.ts` changed to collect all missing fields before throwing. |
| **AC-5** (seed.ts Phase 2 fixtures idempotent) | ✅ Met | `seed.ts` includes `seedPhase2Candidate`, `seedPhase2AvailabilityWindow`, `seedPhase2CoverageRequest`, `seedPhase2FormDefinition`, `seedPhase2DocumentArchiveItems`; `seed.test.ts` verifies idempotency. |
| **AC-6** (gates run and reported) | ⚠️ Partial | Lint, typecheck, unit tests all pass (shown in log excerpts). E2E gate results are **not provided**; the task requires running `npm run e2e` and reporting Playwright pass/fail counts. |
| **AC-7** (no _generated edits, no credentials) | ✅ Met | No changes to `convex/_generated/`; no credentials committed. |

### Concrete Issues Requiring Changes

#### 1. Missing E2E spec fix (AC-1 blocker)

**File:** `tests/e2e/scheduling.spec.ts` (not in diff)

The plan requires the "Send request" button to be scrolled into view before clicking, with a `force` fallback. The diff does not touch this file. Without this change, the E2E test will continue to fail with "outside of the viewport" errors on small viewports.

**Request:** Add the scroll/force click logic to `tests/e2e/scheduling.spec.ts` around line 154.

#### 2. Role resolution order in `authHelpers.ts` contradicts comment

**File:** `convex/authHelpers.ts`, lines 138–155

The comment states: *"The top-level claim is authoritative when both are present"*. However, the new code checks compact `o.rol` first, then `o.rol` string, then `org_role`. If a token has both `org_role` and `o.rol`, the compact `o.rol` will be used, **not** `org_role`. This is a regression from the previous behavior where `org_role` was checked first.

**Request:** Either restore the original order (check `org_role` first) or update the comment to match the actual priority. The current implementation is inconsistent with the stated intent and could break existing tokens that rely on `org_role`.

#### 3. Missing E2E gate results (AC-6)

The task requires running `npm run e2e` and reporting real Playwright pass/fail counts. The log excerpts only show lint, typecheck, and unit tests. Without E2E results, we cannot confirm the suite is green.

**Request:** Run `npm run e2e` and include the output (or at least the pass/fail summary) in the final report.

### Minor Observations (Not Blockers)

- **`convex/files.ts`** adds `org:candidate` to `generateUploadUrl` allowed roles. This is likely intentional for Phase 2 document upload, but ensure that downstream mutations (e.g., `createDocumentArchiveItem`) also allow `org:candidate` to create items. The diff does not show that change; if not, candidates can upload files but cannot link them to their records.
- **`convex/seed.ts`** `deleteFixtureCaregiverShifts` now deletes all shifts for any `org:caregiver` member in the tenant, not just fixture users. This is more aggressive but acceptable for test cleanup.
- **`convex/candidates.ts`** `updateClerkMembershipRole` now lists memberships and updates the first one if the target role doesn't exist. This is idempotent and safe.

### Verdict

The integration test additions are complete and correct. However, two concrete issues remain:

1. The E2E scheduling spec is not fixed (AC-1 blocker).
2. The `authHelpers.ts` role resolution order contradicts the comment and may cause a regression.

**CHANGES_REQUESTED**

VERDICT: CHANGES_REQUESTED