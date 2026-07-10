# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of the code change

### AC coverage

| AC | Status | Notes |
|---|---|---|
| **AC-1** (scheduling.spec.ts passes) | ❌ **Not satisfied** | The diff does **not** modify `tests/e2e/scheduling.spec.ts`. The plan required fixing the “Send request” click (scroll into view + force fallback) and the stale-shift cleanup. Neither change is present. |
| **AC-2** (onboarding.test.ts lifecycle assertions) | ✅ Satisfied | `convex/onboarding.test.ts` now asserts `form_submission` task is `complete` after `submitApplication` (lines ~450–460) and that `hireCandidate` returns an `employeeProfileId` with `adpSyncStatus === 'pending_credentials'` (lines ~510–520). |
| **AC-3** (scheduling.test.ts cross-caregiver + excludeShiftId) | ✅ Satisfied | `convex/scheduling.test.ts` adds `checkShiftConflict` with `excludeShiftId` returning `null` (lines ~323–355) and a cross-caregiver overlap test (lines ~512–550). |
| **AC-4** (forms.test.ts multiple missing fields + updateDocumentArchiveItem) | ✅ Satisfied | `convex/forms.test.ts` adds a test for multiple missing required fields (lines ~530–560) and two `updateDocumentArchiveItem` tests (lines ~873–1000). |
| **AC-5** (seed.ts Phase 2 fixtures idempotent) | ✅ Satisfied | `convex/seed.ts` adds `deleteFixtureCaregiverShifts`, `seedPhase2Candidate`, `seedPhase2AvailabilityWindow`, `seedPhase2CoverageRequest`, `seedPhase2FormDefinition`, `seedPhase2DocumentArchiveItems`. `convex/seed.test.ts` verifies idempotency. |
| **AC-6** (all gates run and reported) | ⚠️ Partial | Only lint, typecheck, and unit test results are provided. E2E and build results are missing. The diff does not include the e2e fix, so e2e likely still fails. |
| **AC-7** (no _generated edits, no credentials committed) | ✅ Satisfied | No changes to `convex/_generated/`. No `.env` files committed. |

### Concrete issues

1. **Missing e2e scheduling.spec.ts fix (AC-1 blocker)**  
   The plan explicitly required modifying `tests/e2e/scheduling.spec.ts` to scroll the “Send request” button into view (with a `force` fallback) and to fix the stale-shift conflict. The diff contains **no changes** to this file. Without this fix, the E2E gate will continue to fail on the coverage-request step.  
   **Action required:** Add the scroll/force click and ensure `deleteFixtureCaregiverShifts` (already added in `seed.ts`) is invoked before the test runs (it is, via `resetE2EShifts` in `tests/e2e/helpers/auth.ts` – that part is fine, but the click fix is missing).

2. **`deleteFixtureCaregiverShifts` only matches Clerk user id, not Convex member `_id`**  
   The plan’s discovery notes chose to match **both** to harden against future code paths that might store the member `_id` as `caregiverId`. The current implementation (lines 568–585 of `seed.ts`) only matches Clerk user ids. While this works today because all shifts use Clerk user ids, it is a deviation from the plan’s explicit decision.  
   **Recommendation:** Add a second pass that resolves each fixture Clerk user id to its `tenantMembers._id` and deletes shifts matching that `_id` as well. This is a low-risk hardening step.

3. **`updateClerkMembershipRole` return type change may affect callers**  
   The return type changed from `{ updated: true }` to `{ updated: boolean, membershipId: string | null }`. The diff does not show updates to callers (e.g., `hireCandidate` in `candidates.ts`). The unit tests pass, so callers were likely updated, but the truncated diff prevents full verification.  
   **Action:** Confirm that all callers of `updateClerkMembershipRole` handle the new shape, especially the `membershipId` field.

4. **Missing e2e and build gate results**  
   The plan required reporting actual pass/fail counts for all five gates. Only lint, typecheck, and unit test results are provided. The e2e and build results are absent.  
   **Action:** Run `npm run e2e` and `npm run build` and include the results.

### Security / PHI / idempotency

- **PHI:** No new PHI exposure. `documentArchiveItems` remain guarded by `requireTenantRole` with `org:admin`/`org:hr` roles. The new `getFormDefinition` query allows `org:candidate` to read form definitions, which is appropriate.
- **Idempotency:** `updateClerkMembershipRole` now lists memberships and checks for the target role before patching, with a catch block that re-verifies. This is robust against retries and races. `completePlatformTraining` and `acceptOffer` already had idempotency guards.
- **Multi-tenancy:** All new queries/mutations use `requireTenantRole` and `assertTenantDoc`. Cross-tenant tests are present.

### Verdict

The code change satisfies most acceptance criteria but **fails AC-1** because the required e2e scheduling.spec.ts fix is missing. Additionally, the `deleteFixtureCaregiverShifts` hardening (matching both Clerk user id and Convex member `_id`) was explicitly chosen in the plan but not implemented. These are concrete blockers.

**CHANGES_REQUESTED**