# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

**Review of `feature/phase-2-worker-onboarding`**

**AC-2 — `convex/onboarding.test.ts` lifecycle assertions** ✅  
The new candidate-lifecycle block (added after the original file’s line 362) explicitly asserts that after `submitApplication` the `form_submission` task is `complete`, and after `hireCandidate` the returned `employeeProfileId` exists with `adpSyncStatus === 'pending_credentials'`. This satisfies the ADP-sync-queued proxy.

**AC-3 — `convex/scheduling.test.ts` cross-caregiver / `excludeShiftId`** ✅  
- Direct `checkShiftConflict` with `excludeShiftId` returning `null` is added in the “scheduling helpers” describe block (around the new line 323).  
- The cross-caregiver overlapping-shifts test is added inside the `createShift` describe block (around the new line 400).

**AC-4 — `convex/forms.test.ts` multiple missing fields + document archive** ✅  
- `convex/forms.ts` now collects all missing required field ids and throws `Missing required fields: ${missing.join(', ')}` (validation loop around line 220).  
- `convex/forms.test.ts` adds a test expecting `Missing required fields: name, experience` (around new line 488).  
- `convex/documentArchive.test.ts` adds a `pending_review` fixture test that verifies `verifiedBy`, `verifiedAt`, and the `document.status_updated` audit event (after line 366). The existing `org:caregiver` block tests remain canonical.

**AC-5 — `convex/seed.ts` idempotent Phase 2 fixtures** ✅  
- `deleteFixtureCaregiverShifts` is hardened: it now deletes shifts whose `caregiverId` matches either the fixture Clerk user ids **or** the Convex `tenantMembers._id` for those users (new function around line 568).  
- Phase 2 fixtures for candidate (`hr_review` with application), availability window, open coverage request, 3-field form definition, and pending-review document archive items are all present and idempotent via lookup-before-insert (around line 876).  
- Note: the candidate is kept at `hr_review` rather than `submitted`. This matches the plan’s documented trade-off to preserve the single-click E2E offer flow, but it is a deviation from the original brief wording.

**AC-7 — No `_generated` edits, no credential leaks** ✅  
The diff does not touch `convex/_generated/`. `.env.e2e.example` only adds placeholder candidate credentials, not real values.

---

**Blockers**

**AC-1 — `tests/e2e/scheduling.spec.ts` is missing from the diff.**  
The git diff stat lists `tests/e2e/geofence.spec.ts`, `tests/e2e/helpers/auth.ts`, `tests/e2e/helpers/env.ts`, and `tests/e2e/phase1-lifecycle.spec.ts`, but **not** `tests/e2e/scheduling.spec.ts`. The seed cleanup change reduces the stale-shift risk, but the Playwright click at the coverage-request step is still the plain `.click()` that previously failed with “outside of the viewport”. The viewport/force fix required by AC-1 has not been applied.

**AC-6 — Real `npm run e2e` and `npm run build` results are not provided.**  
The latest gate excerpts only show `lint`, `typecheck`, and `unit` passing. The plan explicitly requires reported pass/fail counts for all five gates, including E2E and build.

---

**Requested changes**

1. Modify `tests/e2e/scheduling.spec.ts` at the “Send request” coverage step to scroll the button into view and use a force fallback, e.g.:
   ```ts
   const sendRequest = page.locator('button:has-text("Send request")')
   await sendRequest.scrollIntoViewIfNeeded()
   await sendRequest.click({ force: true })
   ```
   Confirm that `resetE2EShifts` (which now calls the hardened `deleteFixtureCaregiverShifts`) runs before the admin overlap assertion so no stale 2026-07-10T13:00 shift remains.

2. Attach the full output of `npm run e2e` and `npm run build`, including pass/fail counts and, for Playwright, `test-results/.last-run.json` if available.

---

**Non-blocking observations**

- `convex/forms.ts` adds a new `getFormDefinition` query, and `convex/files.ts` widens `generateUploadUrl` to allow `org:candidate`. Neither has new test coverage in the diff; consider adding focused tests since they are user-facing touched behaviour.
- The `hrCases.ts` refactor includes subject validation, audit logging, and cross-tenant guards, and `hrCases.test.ts` adds corresponding coverage — this looks solid.

VERDICT: CHANGES_REQUESTED