# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Code Review: ATRIA-X Phase 2 E2E + Integration Tests

### AC-1: scheduling.spec.ts — "Send request" button fix MISSING

The plan explicitly required scrolling the "Send request" button into view before clicking (with a `force: true` fallback) to fix the Playwright "outside of the viewport" error. **`tests/e2e/scheduling.spec.ts` does not appear in the diff at all.** The stale-shift cleanup in `seed.ts` is improved (good — see below), but the viewport/click issue remains unaddressed. This is a concrete AC miss that will cause the E2E test to continue failing.

The `playwright.config.ts` change (4 lines) may adjust viewport size, but the plan called for a robust `scrollIntoViewIfNeeded()` + `force` fallback in the spec itself, not a config workaround.

### AC-2: onboarding.test.ts — ✅ Complete

- `inviteCandidate` → 5 tasks in order ✅
- `submitApplication` → `form_submission` task `complete` ✅ (line ~425 of the new lifecycle test)
- Full lifecycle `invited → applied → hr_review → offer_sent → accepted → hired` ✅
- `hireCandidate` → `employeeProfile` created + `adpSyncStatus === 'pending_credentials'` ✅
- `acceptOffer` idempotent ✅
- `org:candidate` blocked from `listShifts` ✅

### AC-3: scheduling.test.ts — ✅ Complete

- `checkShiftConflict` with `excludeShiftId` returns `null` ✅
- Cross-caregiver overlapping shifts allowed ✅
- `createShift` audit event ✅
- Non-caregiver `assignedCaregiver` blocked ✅
- Same-caregiver overlap rejected ✅

### AC-4: forms.test.ts — ✅ Complete

- Multiple missing required fields lists them (`Missing required fields: name, experience`) ✅
- `updateDocumentArchiveItem` sets `verifiedBy`/`verifiedAt` ✅ (via `documentArchive` API in forms.test.ts)
- `org:caregiver` blocked from `updateDocumentArchiveItem` ✅

**Note on `forms.ts` breaking change:** The error message format changed from singular `Missing required field: X` to always-plural `Missing required fields: X` (even for one field). All existing tests are updated to match. This is per the brief but is a client-facing breaking change — any frontend code matching on the old format will break.

### AC-5: seed.ts Phase 2 fixtures — ✅ Mostly complete

- Candidate in `hr_review` with application ✅
- Availability window ✅
- Coverage request in `open` ✅
- 3-field form definition (name required, experience required, notes optional) ✅
- Document archive items in `pending_review` ✅
- Idempotent (delete-before-insert pattern) ✅
- `seed.test.ts` verifies idempotency ✅

**`deleteFixtureCaregiverShifts` rewrite** (lines 568–630): Now matches both Clerk user IDs and Convex `tenantMembers._id`, and also deletes all future shifts in the tenant. This is more robust and addresses the stale-shift conflict. Good.

### AC-6: Gate results — INCOMPLETE

Only lint, typecheck, and unit tests (451 pass) are reported. **E2E and build gates are missing.** The scheduling E2E spec will fail without the "Send request" fix.

### AC-7: No edits to `_generated/`, no credentials — ✅

### Security / Correctness Issues

1. **`candidates.ts` — `updateClerkMembershipRole` mock compatibility**: The function now makes two Clerk API calls (list memberships, then PATCH). The test assertion at `candidates.test.ts:583` was updated to match the new list URL pattern, but the mock returns a flat object `{ id, email_address, role, ... }` rather than the Clerk list format `{ data: [{ id, role, ... }] }`. This means `list.data` will be `undefined`, `targetMembership` will be `undefined`, and the function returns `{ updated: false, membershipId: null }` without ever making the PATCH call. The role update silently no-ops in tests. While all 451 tests pass (because the test doesn't assert on the PATCH call or the role actually changing), this means the new two-call path is **untested**. The mock should return `{ data: [{ id: 'mem_xxx', role: 'org:member' }] }` for the list call.

2. **`hrCases.ts` — `resolveSubjectName` error handling**: In `listHrCases`, the `resolveSubjectName` call is wrapped in `try/catch` with `subjectName = 'Unknown'` fallback. This silently swallows tenant-isolation violations — if a case references a subject in another tenant, `assertTenantDoc` would throw, and the name would silently become `'Unknown'` instead of surfacing the data integrity issue. Not a blocker, but worth noting.

3. **`files.ts` — `org:candidate` added to `generateUploadUrl`**: Candidates can now obtain storage upload URLs. The mutation only generates a URL; file-to-document association happens in separate mutations with their own guards. Acceptable, but verify those downstream mutations also restrict candidates to their own documents.

4. **`seed.ts` — aggressive future-shift deletion**: `deleteFixtureCaregiverShifts` now deletes **all** future shifts in the tenant (not just fixture caregiver shifts). Line ~625: `const isFuture = shift.scheduledStart >= todayStart; if (!matchesFixtureCaregiver && !isFuture) { continue; }`. This is appropriate for E2E test cleanup but would be destructive if ever run against a shared/production tenant. The function name suggests it only deletes fixture caregiver shifts, but the behavior is broader. Consider renaming or adding a comment.

### Summary of Required Changes

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | **Missing "Send request" scroll/force fix** — AC-1 explicitly required | Blocker | `tests/e2e/scheduling.spec.ts` |
| 2 | **Mock doesn't exercise new two-call Clerk path** — `updateClerkMembershipRole` PATCH is untested | High | `convex/candidates.test.ts` |
| 3 | **E2E + build gate results not reported** — AC-6 incomplete | Medium | N/A |

VERDICT: CHANGES_REQUESTED