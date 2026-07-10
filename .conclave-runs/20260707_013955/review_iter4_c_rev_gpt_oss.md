# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Review Summary**

The submitted changes address the majority of the integration‑test gaps and add substantial test coverage:

| Area | ✅ Implemented | Comments |
|------|----------------|----------|
| **Onboarding lifecycle assertions** | ✅ `convex/onboarding.test.ts` now checks that `submitApplication` completes the `form_submission` task and that `hireCandidate` creates an `employeeProfile` with `adpSyncStatus: 'pending_credentials'`. |
| **Scheduling helpers** | ✅ New tests in `convex/scheduling.test.ts` cover cross‑caregiver overlap, audit events, and `checkShiftConflict` with `excludeShiftId`. |
| **Form validation** | ✅ `convex/forms.ts` now aggregates missing required fields and throws `Missing required fields: …`. Tests in `convex/forms.test.ts` verify single‑ and multi‑field failures and added `getFormDefinition` query with role guards. |
| **Document archive** | ✅ Tests added for pending‑review verification and for `updateDocumentArchiveItem` (including caregiver block). |
| **HR cases** | ✅ Expanded subject validation, employee seeding, and cross‑tenant isolation tests. |
| **Seed fixtures** | ✅ `convex/seed.test.ts` now asserts idempotent Phase 2 fixture creation. |
| **Auth helpers** | ✅ Robust handling of top‑level vs compact Clerk JWT claims. |
| **File upload permissions** | ✅ `org:candidate` now allowed to generate upload URLs (tests added). |
| **Miscellaneous** | ✅ Minor bug‑fixes (client?.phone, HMR overlay, etc.) and lint/type‑check pass. |

All unit and integration tests now pass (`npm run test` reports 65 test files, 456 tests, 0 failures).

**Missing Acceptance Criteria**

1. **E2E “Send request” button click** – `tests/e2e/scheduling.spec.ts` still clicks the “Send request” button without scrolling or forcing. Playwright will continue to report *“element is outside of the viewport”* failures.  
2. **Stale‑shift cleanup** – The new `deleteFixtureCaregiverShifts` implementation was added, but the diff is truncated; we need to confirm it deletes shifts whose `caregiverId` matches **either** the fixture Clerk user ID **or** the corresponding `tenantMembers._id`. If it only matches the Clerk ID, the admin‑overlap conflict may persist.  
3. **E2E run** – No evidence that `npm run e2e` was executed after the changes. The gate results only show lint, type‑check, and unit tests.

**Security / PHI Review**

- The expanded `candidates.updateClerkMembershipRole` now lists memberships via the Clerk API before patching. This is an internal action protected by the server‑side secret key; no new client‑exposed endpoints are introduced.  
- `convex/authHelpers` now correctly prefers top‑level JWT claims, preserving existing security contracts.  
- No new data leakage or PHI exposure was introduced.

**Requested Changes**

1. **Fix the “Send request” click in the E2E test**  
   - Update `tests/e2e/scheduling.spec.ts` to locate the button, call `await button.scrollIntoViewIfNeeded()` (or `await button.evaluate(node => node.scrollIntoView())`) before `.click()`.  
   - Add a fallback `click({ force: true })` in case the element remains off‑screen.  
   - Optionally insert a short `await page.waitForTimeout(200)` after opening the coverage panel to let UI settle.

2. **Verify and, if needed, tighten `deleteFixtureCaregiverShifts`**  
   - Ensure the function deletes shifts where `shift.caregiverId` equals **either** the fixture Clerk user ID **or** the `tenantMembers._id` for that user.  
   - Add a comment explaining the dual‑key match for future maintainers.  
   - Add a unit test (e.g., in `convex/seed.test.ts`) that creates a shift with a member `_id` and confirms it is removed by the cleanup routine.

3. **Run the full E2E suite**  
   - Execute `npm run e2e` locally and confirm that all three spec files (`onboarding.spec.ts`, `documents.spec.ts`, `scheduling.spec.ts`) now pass.  
   - Capture the pass/fail counts from `test-results/` and include them in the final gate report.

Once the above adjustments are made and the E2E gate passes, the repository will satisfy **all** acceptance criteria.

---

**Verdict:** CHANGES_REQUESTED