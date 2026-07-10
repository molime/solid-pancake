# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 E2E + Integration Tests

### Summary
This is a substantial change (49 files, 3219 insertions) adding comprehensive integration tests and backend support for Phase 2 worker onboarding. The integration test coverage is excellent, but **critical E2E gate results are missing** from the provided output.

---

### Acceptance Criteria Verification

| AC | Status | Evidence |
|---|---|---|
| AC-1: `scheduling.spec.ts` click fix | **NOT VERIFIED** | File not in diff; E2E gate results not shown |
| AC-2: `onboarding.test.ts` lifecycle assertions | ✅ PASS | Lines 420-425 (`form_submission` complete), 467-470 (`adpSyncStatus`) |
| AC-3: `scheduling.test.ts` cross-caregiver + excludeShiftId | ✅ PASS | Lines 326-356 (excludeShiftId), 476-507 (cross-caregiver overlap) |
| AC-4: `forms.test.ts` multiple missing fields + archive verify | ✅ PASS | Lines 533-561 (multiple missing), 876-935 (`verifiedBy`/`verifiedAt`) |
| AC-5: `seed.ts` idempotent Phase 2 fixtures | ✅ PASS | Lines 568-640 (dual-id cleanup), 506+ (candidateUserId field) |
| AC-6: All gates pass with real counts | **PARTIAL** | lint/typecheck/unit shown; **e2e/build missing** |
| AC-7: No `_generated/` edits, no credentials | ✅ PASS | No `_generated/` in diff; `.env.e2e.example` has placeholders |

---

### Critical Issues Requiring Changes

#### 1. Missing E2E Gate Results (AC-1, AC-6 Blocker)
The plan explicitly requires:
> "Run the full `npm run e2e` gate (not just focused specs) at the end and report real Playwright pass/fail counts from test-results/."

**The provided gate output shows:**
- ✅ lint (PASS)
- ✅ typecheck (PASS)  
- ✅ unit (456 tests, 65 files, all PASS)
- ❌ **e2e — NOT SHOWN**
- ❌ **build — NOT SHOWN**

Without E2E results, AC-1 (scheduling.spec.ts reliability) cannot be verified. The original task stated `scheduling.spec.ts` had a "Send request" viewport failure and stale-shift conflict that needed fixing. **Neither the E2E spec changes nor the E2E gate results appear in this diff/output.**

**Request:** Provide `npm run e2e` and `npm run build` gate results with actual pass/fail counts before approval.

---

#### 2. `convex/candidates.ts` — Clerk API Retry Safety (Security/Reliability)
**File:** `convex/candidates.ts`, lines 171-196

The new `updateClerkMembershipRole` action now makes **two sequential Clerk API calls** (list memberships, then PATCH):

```typescript
// Line 174-183: List memberships
const listResponse = await fetch(...)
const list = (await listResponse.json()) as { data?: Array<{ id: string; role: string }> }
const membership = list.data?.find((m) => m.role === toClerkRole(args.role))
if (membership) {
  return { updated: false, membershipId: membership.id }  // Early return
}

// Line 188-196: PATCH membership
const response = await fetch(...)
```

**Risk:** If the PATCH succeeds but the response parsing fails (line 193 `response.json().catch(() => ({}))`), the action throws but the Clerk membership **was already updated**. This creates a state mismatch where Convex thinks the update failed but Clerk has the new role.

**Request:** Add idempotency tracking or make the early-return check (line 180) also verify the `public_metadata.atriaRole` matches, not just the Clerk role string. Alternatively, wrap the PATCH in a try-catch that returns success if the membership already has the target role.

---

#### 3. `convex/hrCases.ts` — N+1 Query in `listHrCases` (Performance)
**File:** `convex/hrCases.ts`, lines 119-153

The `listHrCases` query now calls `resolveSubjectName` for **every case** in a loop:

```typescript
return await Promise.all(
  cases.map(async (c) => {
    // ... calls resolveSubjectName which does db.get() or query().unique()
  })
)
```

For a dashboard with 100+ HR cases, this creates 100+ database reads. While `Promise.all` parallelizes, this is still an N+1 pattern.

**Request:** Batch-resolve subjects by collecting all `subjectId`s first, then doing bulk lookups. For now, add a comment acknowledging this is acceptable for expected case volumes (<50 active cases per tenant).

---

#### 4. `convex/forms.ts` — Error Message Change (Contract Risk)
**File:** `convex/forms.ts`, lines 223-233

Changed from:
```typescript
throw new ConvexError(`Missing required field: ${field.id}`)  // Singular
```
To:
```typescript
throw new ConvexError(`Missing required fields: ${missing.join(', ')}`)  // Plural + list
```

**Risk:** Any frontend code parsing this error message (e.g., extracting field names) will break. The existing tests were updated (see `convex/forms.test.ts` lines 340, 530, 583, 616, 699, 787, 826, 861), but **frontend components consuming this error are not shown in the diff**.

**Request:** Verify frontend error handling in `src/features/onboarding/ApplicationFormPage.tsx` or similar components that catch `submitForm` errors. If they parse the error string, update them to handle the new format.

---

#### 5. `convex/seed.ts` — Future Shift Deletion Scope (Data Safety)
**File:** `convex/seed.ts`, lines 614-626

```typescript
// Also wipe any future shifts in the tenant.
const now = new Date()
const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
// ... deletes all shifts with scheduledStart >= todayStart
```

**Risk:** This deletes **all future shifts** in the E2E tenant, not just fixture shifts. If E2E tests create shifts for specific scenarios and then the cleanup runs mid-suite (e.g., on test retry), it could delete shifts that subsequent tests expect to exist.

**Request:** Scope the deletion to shifts created by the current test run (e.g., tag shifts with a `testRunId` metadata field) or limit to shifts within a specific date window (e.g., next 30 days) rather than "all future."

---

### Positive Findings

1. **Multi-tenancy guards consistent**: All new mutations use `requireTenantRole` and `assertTenantDoc` (e.g., `convex/forms.ts` line 362, `convex/hrCases.ts` line 62).

2. **PHI/document access properly guarded**: `updateDocumentArchiveItem` tests verify `org:caregiver` is blocked (`convex/forms.test.ts` lines 908-935, `convex/documentArchive.test.ts` lines 366-419).

3. **Idempotency well-handled**: `seedE2E` checks for existing fixtures before inserting (`convex/seed.test.ts` lines 427-475 verify counts remain 1 after second call).

4. **Test coverage comprehensive**: 456 unit tests across 65 files, including new `hrCases.test.ts` (8 tests), `files.test.ts` (8 tests), and expanded `onboarding.test.ts` (9 tests).

---

### Missing Files from Diff

The following files mentioned in the plan are **not visible** in the diff:
- `tests/e2e/scheduling.spec.ts` — Critical for AC-1
- `tests/e2e/onboarding.spec.ts` — Should verify no regression
- `tests/e2e/documents.spec.ts` — Should verify no regression
- `src/features/scheduling/components/ShiftPacketPanel.tsx` — Plan mentioned a patch was applied; only 91 lines changed but need to verify the `client?.phone` fix persists

---

### Recommendation

**CHANGES_REQUESTED** — The integration test coverage is excellent and the backend changes are sound, but:

1. **E2E gate results must be provided** before this can be approved. Without them, AC-1 and AC-6 cannot be verified.
2. **Clerk API retry safety** needs addressing to prevent state mismatches.
3. **Frontend error handling** for the changed `submitForm` error message should be verified.

Once E2E results are provided and the Clerk API idempotency is addressed, this change is ready to merge.

VERDICT: CHANGES_REQUESTED